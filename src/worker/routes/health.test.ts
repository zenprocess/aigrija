import { describe, it, expect } from 'vitest';
import { health } from './health';

function mockKV(throwOnGet = false): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => {
      if (throwOnGet) throw new Error('KV error');
      return store.get(key) || null;
    },
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function mockR2(): R2Bucket {
  return {
    head: async () => null,
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false }),
    createMultipartUpload: async () => ({}),
    resumeMultipartUpload: async () => ({}),
  } as unknown as R2Bucket;
}

describe('/health', () => {
  it('returns 200 with ok status when all bindings available', async () => {
    const env = { CACHE: mockKV(), AI: {}, STORAGE: mockR2() };
    const res = await health.request('/health', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
    expect(body.checks).toBeDefined();
  });

  it('returns 503 when KV throws', async () => {
    const env = { CACHE: mockKV(true), AI: {}, STORAGE: mockR2() };
    const res = await health.request('/health', undefined, env);
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe('degraded');
  });
});
