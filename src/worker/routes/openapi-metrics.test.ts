import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { MetricsEndpoint } from './openapi-metrics';

function makeKV(opts: { throws?: boolean; value?: string | null } = {}): KVNamespace {
  return {
    get: async () => {
      if (opts.throws) throw new Error('KV down');
      return opts.value ?? null;
    },
    put: async () => {},
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  const endpoint = new MetricsEndpoint();
  app.get('/api/health/metrics', (c) => {
    c.set('requestId', 'test-rid');
    return endpoint.handle(c as any);
  });
  return app;
}

function makeCtx(): any {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
}

describe('GET /api/health/metrics (MetricsEndpoint)', () => {
  it('returns 200 with uptime_ms, stats, and bindings', async () => {
    const env = { CACHE: makeKV({ value: '42' }), AI: {}, STORAGE: {} };
    const res = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
    expect(body.uptime_human).toBeDefined();
    expect(body.stats.total_checks).toBe(42);
    expect(body.timestamp).toBeDefined();
    expect(body.request_id).toBe('test-rid');
  });

  it('reports bindings.kv as ok when KV is reachable', async () => {
    const env = { CACHE: makeKV({ value: '0' }), AI: {}, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.bindings.kv).toBe('ok');
  });

  it('reports bindings.kv as unavailable when KV throws', async () => {
    const env = { CACHE: makeKV({ throws: true }), AI: {}, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.bindings.kv).toBe('unavailable');
    expect(body.stats.total_checks).toBe(0);
  });

  it('reports bindings.ai as ok when AI binding is present', async () => {
    const env = { CACHE: makeKV(), AI: {}, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.bindings.ai).toBe('ok');
  });

  it('reports bindings.ai as unavailable when AI binding is absent', async () => {
    const env = { CACHE: makeKV(), AI: null, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.bindings.ai).toBe('unavailable');
  });

  it('reports bindings.r2 as unavailable when STORAGE binding is absent', async () => {
    const env = { CACHE: makeKV(), AI: {}, STORAGE: null };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.bindings.r2).toBe('unavailable');
  });

  it('uptime_human ends with seconds component', async () => {
    const env = { CACHE: makeKV(), AI: {}, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.uptime_human).toMatch(/\d+s$/);
  });

  it('returns zero total_checks when KV key is absent', async () => {
    const env = { CACHE: makeKV({ value: null }), AI: {}, STORAGE: {} };
    const body = await makeApp().fetch(
      new Request('http://localhost/api/health/metrics'), env, makeCtx()
    ).then((r) => r.json() as any);
    expect(body.stats.total_checks).toBe(0);
  });
});
