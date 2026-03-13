import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeCommunityReport, type CommunityReport } from './community';
import app from '../index';


/** Compute the KV key for the current fixed window. */
function rlKey(identifier: string, windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const windowSlot = Math.floor(now / windowSeconds);
  return `rl:${identifier}:${windowSlot}`;
}
// Minimal KV mock — supports list() with prefix/limit for report-idx queries
function makeKV(store: Record<string, string> = {}): KVNamespace {
  const data = { ...store };
  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    put: vi.fn(async (key: string, value: string) => { data[key] = value; }),
    delete: vi.fn(async (key: string) => { delete data[key]; }),
    list: vi.fn(async (opts?: { prefix?: string; limit?: number }) => {
      const prefix = opts?.prefix ?? '';
      const limit = opts?.limit ?? 1000;
      const keys = Object.keys(data)
        .filter(k => k.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: '' };
    }),
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

  it('writes a report-idx: key containing the report id', async () => {
    const kv = makeKV();
    await storeCommunityReport(kv, 'new-id', { text: 'test', verdict: 'phishing' });
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    // Should write exactly 2 keys: report:{id} and report-idx:{reverseTs}:{id}
    expect(putCalls.length).toBe(2);
    const idxCall = putCalls.find((c: string[]) => c[0].startsWith('report-idx:'));
    expect(idxCall).toBeDefined();
    // The key includes the report id after the last colon
    expect(idxCall[0].endsWith(':new-id')).toBe(true);
    // The value stored is the id itself
    expect(idxCall[1]).toBe('new-id');
  });
});

describe('storeCommunityReport — KV key isolation', () => {
  it('never reads or writes the old report-index key', async () => {
    // The old implementation had a race condition on a shared 'report-index' array.
    // The new implementation writes individual report-idx: keys — no shared key.
    const kv = makeKV({ 'report-index': 'stale-data-ignored' });
    await expect(
      storeCommunityReport(kv, 'new-id', { text: 'test', verdict: 'phishing' })
    ).resolves.toBeUndefined();
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const oldIndexCall = putCalls.find((c: string[]) => c[0] === 'report-index');
    expect(oldIndexCall).toBeUndefined();
  });
});

describe('storeCommunityReport — concurrent submissions', () => {
  it('both submissions persist in KV when called concurrently', async () => {
    const kv = makeKV();
    await Promise.all([
      storeCommunityReport(kv, 'report-a', { text: 'Mesaj suspect A', verdict: 'phishing' }),
      storeCommunityReport(kv, 'report-b', { text: 'Mesaj suspect B', verdict: 'spam' }),
    ]);

    const reportA = await kv.get('report:report-a');
    const reportB = await kv.get('report:report-b');
    expect(reportA).not.toBeNull();
    expect(reportB).not.toBeNull();

    const storedA: CommunityReport = JSON.parse(reportA!);
    const storedB: CommunityReport = JSON.parse(reportB!);
    expect(storedA.id).toBe('report-a');
    expect(storedB.id).toBe('report-b');

    const listed = await kv.list({ prefix: 'report-idx:' });
    expect(listed.keys.length).toBe(2);
  });

  it('report listing returns all concurrently submitted reports', async () => {
    const kv = makeKV();
    await Promise.all([
      storeCommunityReport(kv, 'conc-a', { text: 'Raport A', verdict: 'phishing' }),
      storeCommunityReport(kv, 'conc-b', { text: 'Raport B', verdict: 'spam' }),
    ]);

    const env = {
      CACHE: kv,
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports');
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as CommunityReport[];
    expect(body.length).toBe(2);
    const ids = body.map((r: CommunityReport) => r.id).sort();
    expect(ids).toEqual(['conc-a', 'conc-b']);
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

  it('falls through to fresh data when cached list is corrupt JSON', async () => {
    const env = {
      CACHE: makeKV({ 'community-reports-list': 'BAD_JSON' }),
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports');
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    // Should not 500; falls through and returns empty array from fresh fetch
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns empty array when no report-idx: keys exist', async () => {
    const env = {
      CACHE: makeKV({}),
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

  it('does not mutate the shared community-reports-list key on vote', async () => {
    const cachedList = JSON.stringify([{ id: 'r1', votes_up: 3, votes_down: 1 }]);
    const report: CommunityReport = { id: 'r1', text_snippet: 'test', votes_up: 3, votes_down: 1, created_at: '2026-01-01T00:00:00.000Z', verdict: 'phishing' };
    const kv = makeKV({ 'report:r1': JSON.stringify(report), 'community-reports-list': cachedList });
    const env = {
      CACHE: kv,
      ASSETS: { fetch: vi.fn() },
    };
    const req = new Request('http://localhost/api/reports/r1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '2.2.2.2' },
      body: JSON.stringify({ vote: 'up' }),
    });
    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);
    // The shared index must not be deleted or rewritten by the vote handler
    expect(kv.delete).not.toHaveBeenCalledWith('community-reports-list');
    const deleteCalls = (kv.delete as ReturnType<typeof vi.fn>).mock.calls;
    const indexMutation = deleteCalls.find((c: string[]) => c[0] === 'community-reports-list');
    expect(indexMutation).toBeUndefined();
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
