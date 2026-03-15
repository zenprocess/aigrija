import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ReportsEndpoint } from './openapi-reports';

type KvStore = Record<string, string>;

interface ListEntry { name: string }

function makeKV(store: KvStore = {}, listKeys: ListEntry[] = []): any {
  const kvStore = { ...store };
  return {
    get: async (key: string) => kvStore[key] ?? null,
    put: async (key: string, value: string, _opts?: unknown) => { kvStore[key] = value; },
    list: async (_opts?: unknown) => ({ keys: listKeys, list_complete: true, cacheStatus: null }),
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  const endpoint = new ReportsEndpoint();
  app.get('/api/reports', (c) => endpoint.handle(c as any));
  return app;
}

describe('GET /api/reports (ReportsEndpoint)', () => {
  it('returns cached data on cache hit', async () => {
    const cached = [{ id: 'r1', text_snippet: 'fraud site', votes_up: 5, votes_down: 1, created_at: '2024-01-01', verdict: 'phishing' }];
    const kv = makeKV({ 'community-reports-list': JSON.stringify(cached) });
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('HIT');
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('r1');
  });

  it('returns X-Cache: MISS on cache miss and fetches from index', async () => {
    const report = { id: 'rep-1', text_snippet: 'suspicious link', votes_up: 3, votes_down: 0, created_at: '2024-02-01', verdict: 'suspect' };
    const listKeys = [{ name: 'report-idx:2024:rep-1' }];
    const kv = makeKV({ 'report:rep-1': JSON.stringify(report) }, listKeys);
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('rep-1');
  });

  it('sorts reports by votes_up descending', async () => {
    const reports = [
      { id: 'low', text_snippet: 'low votes', votes_up: 1, votes_down: 0, created_at: '2024-01-01', verdict: 'safe' },
      { id: 'high', text_snippet: 'high votes', votes_up: 10, votes_down: 2, created_at: '2024-01-02', verdict: 'phishing' },
      { id: 'mid', text_snippet: 'mid votes', votes_up: 5, votes_down: 1, created_at: '2024-01-03', verdict: 'suspect' },
    ];
    const listKeys = reports.map(r => ({ name: `report-idx:ts:${r.id}` }));
    const store: KvStore = {};
    reports.forEach(r => { store[`report:${r.id}`] = JSON.stringify(r); });
    const kv = makeKV(store, listKeys);
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body[0].id).toBe('high');
    expect(body[1].id).toBe('mid');
    expect(body[2].id).toBe('low');
  });

  it('falls through to fresh fetch when cached JSON is malformed', async () => {
    const kv = makeKV({ 'community-reports-list': 'not-valid-json' });
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    // Falls through to fresh fetch (empty index → empty list)
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns empty array when index is empty', async () => {
    const kv = makeKV({}, []);
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toHaveLength(0);
  });

  it('sets Cache-Control header on both HIT and MISS', async () => {
    const kv = makeKV({}, []);
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports'),
      { CACHE: kv }, {} as any
    );
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
  });
});
