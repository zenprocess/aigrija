import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeCommunityReport, type CommunityReport } from './community';
import app from '../index';


/** Compute the KV key for the current fixed window. */
function rlKey(identifier: string, windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const windowSlot = Math.floor(now / windowSeconds);
  return `rl:${identifier}:${windowSlot}`;
}
// Minimal KV mock
function makeKV(store: Record<string, string> = {}): KVNamespace {
  const data = { ...store };
  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    put: vi.fn(async (key: string, value: string) => { data[key] = value; }),
    delete: vi.fn(async (key: string) => { delete data[key]; }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

describe('storeCommunityReport', () => {
  it('stores report with initial votes_up=1 votes_down=0', async () => {
    const kv = makeKV();
    await storeCommunityReport(kv, 'test-id-123', {
      url: 'http://phishing.ro',
      text: 'Un mesaj suspect de la banca ta',
      verdict: 'phishing',
      reporter_ip_hash: 'abc123',
    });

    expect(kv.put).toHaveBeenCalledTimes(2); // report + index
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = putCalls.find((c: string[]) => c[0] === 'report:test-id-123');
    expect(reportCall).toBeDefined();
    const stored: CommunityReport = JSON.parse(reportCall[1]);
    expect(stored.id).toBe('test-id-123');
    expect(stored.votes_up).toBe(1);
    expect(stored.votes_down).toBe(0);
    expect(stored.verdict).toBe('phishing');
    expect(stored.text_snippet).toBe('Un mesaj suspect de la banca ta');
  });

  it('truncates text to 100 chars for snippet', async () => {
    const kv = makeKV();
    const longText = 'A'.repeat(200);
    await storeCommunityReport(kv, 'id-2', { text: longText, verdict: 'suspicious' });
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = putCalls.find((c: string[]) => c[0] === 'report:id-2');
    const stored: CommunityReport = JSON.parse(reportCall[1]);
    expect(stored.text_snippet.length).toBe(100);
  });

  it('prepends new id to existing index', async () => {
    const existingIndex = JSON.stringify(['old-id-1', 'old-id-2']);
    const kv = makeKV({ 'report-index': existingIndex });
    await storeCommunityReport(kv, 'new-id', { text: 'test', verdict: 'phishing' });
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const indexCall = putCalls.find((c: string[]) => c[0] === 'report-index');
    const newIndex = JSON.parse(indexCall[1]);
    expect(newIndex[0]).toBe('new-id');
    expect(newIndex).toContain('old-id-1');
  });
});

describe('GET /api/reports', () => {
  it('returns empty array when no reports exist', async () => {
    const env = {
      CACHE: makeKV(),
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports');
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('returns cached response on second call', async () => {
    const cachedList = JSON.stringify([{ id: 'r1', votes_up: 5, votes_down: 0, verdict: 'phishing', text_snippet: 'test', created_at: '2026-01-01T00:00:00.000Z' }]);
    const env = {
      CACHE: makeKV({ 'community-reports-list': cachedList }),
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports');
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('HIT');
  });
});

describe('POST /api/reports/:id/vote', () => {
  it('returns 404 when report not found', async () => {
    const env = {
      CACHE: makeKV(),
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports/nonexistent/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: 'up' }),
    });
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid vote value', async () => {
    const report: CommunityReport = { id: 'r1', text_snippet: 'test', votes_up: 1, votes_down: 0, created_at: '2026-01-01T00:00:00.000Z', verdict: 'phishing' };
    const env = {
      CACHE: makeKV({ 'report:r1': JSON.stringify(report) }),
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports/r1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: 'sideways' }),
    });
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(400);
  });

  it('increments votes_up and returns updated counts', async () => {
    const report: CommunityReport = { id: 'r1', text_snippet: 'test', votes_up: 3, votes_down: 1, created_at: '2026-01-01T00:00:00.000Z', verdict: 'phishing' };
    const kv = makeKV({ 'report:r1': JSON.stringify(report) });
    const env = {
      CACHE: kv,
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports/r1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ vote: 'up' }),
    });
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as { votes_up: number; votes_down: number };
    expect(body.votes_up).toBe(4);
    expect(body.votes_down).toBe(1);
  });

  it('rate limits after 10 votes per IP', async () => {
    const report: CommunityReport = { id: 'r1', text_snippet: 'test', votes_up: 1, votes_down: 0, created_at: '2026-01-01T00:00:00.000Z', verdict: 'phishing' };
    // Simulate rate limit already hit (counter at 10)
    const kv = makeKV({ 'report:r1': JSON.stringify(report), [rlKey('vote:5.5.5.5', 3600)]: '10' });
    const env = {
      CACHE: kv,
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports/r1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '5.5.5.5' },
      body: JSON.stringify({ vote: 'down' }),
    });
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(429);
  });
});
