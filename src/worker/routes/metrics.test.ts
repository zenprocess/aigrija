import { describe, it, expect } from 'vitest';
import { metrics } from './metrics';

function mockKV(totalChecks?: number): KVNamespace {
  const store = new Map<string, string>();
  if (totalChecks !== undefined) {
    store.set('stats:total_checks', String(totalChecks));
  }
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

describe('GET /api/health/metrics', () => {
  it('returns 200 with uptime and stats', async () => {
    const env = { CACHE: mockKV(42), AI: {}, STORAGE: {} };
    const res = await metrics.request('/api/health/metrics', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
    expect(body.uptime_human).toBeDefined();
    expect(body.stats.total_checks).toBe(42);
    expect(body.timestamp).toBeDefined();
  });

  it('returns zero total_checks when KV has no key', async () => {
    const env = { CACHE: mockKV(), AI: {}, STORAGE: {} };
    const res = await metrics.request('/api/health/metrics', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.stats.total_checks).toBe(0);
  });

  it('reports kv binding status as ok when reachable', async () => {
    const env = { CACHE: mockKV(0), AI: {}, STORAGE: {} };
    const res = await metrics.request('/api/health/metrics', undefined, env);
    const body = await res.json() as any;
    expect(body.bindings.kv).toBe('ok');
    expect(body.bindings.ai).toBe('ok');
    expect(body.bindings.r2).toBe('ok');
  });

  it('reports kv unavailable when KV throws', async () => {
    const brokenKV = {
      get: async () => { throw new Error('KV down'); },
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
    } as unknown as KVNamespace;
    const env = { CACHE: brokenKV, AI: {}, STORAGE: {} };
    const res = await metrics.request('/api/health/metrics', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.bindings.kv).toBe('unavailable');
    expect(body.stats.total_checks).toBe(0);
  });

  it('uptime_human is formatted correctly', async () => {
    const env = { CACHE: mockKV(0), AI: {}, STORAGE: {} };
    const res = await metrics.request('/api/health/metrics', undefined, env);
    const body = await res.json() as any;
    // Should end with seconds
    expect(body.uptime_human).toMatch(/\d+s$/);
  });
});
