import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import type { Env } from '../lib/types';
import { CheckImageEndpoint } from './openapi-check-image';

function makeKV(data: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(data));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function makeR2(): R2Bucket {
  const store = new Map<string, ArrayBuffer>();
  return {
    put: async (key: string, value: any) => { store.set(key, value); },
    get: async (key: string) => {
      const v = store.get(key);
      if (!v) return null;
      return { body: v, text: async () => '' };
    },
    delete: async () => {},
    head: async () => null,
    list: async () => ({ objects: [], truncated: false }),
  } as unknown as R2Bucket;
}

function makeAI() {
  return {
    run: vi.fn().mockResolvedValue({
      response: JSON.stringify({
        verdict: 'phishing',
        confidence: 0.9,
        scam_type: 'Phishing',
        red_flags: ['Suspicious URL'],
        explanation: 'This looks like phishing.',
        recommended_actions: ['Do not click links'],
      }),
    }),
  } as any;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    STORAGE: makeR2(),
    AI: makeAI(),
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.post('/api/check/image', CheckImageEndpoint);
  return honoApp;
}

function makeImageFormData(mimeType = 'image/png', size = 100): FormData {
  const bytes = new Uint8Array(size).fill(0);
  const file = new File([bytes], 'test.png', { type: mimeType });
  const fd = new FormData();
  fd.append('image', file);
  return fd;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/check/image', () => {
  it('returns 200 with classification for a valid image upload', async () => {
    const app = buildApp();
    const fd = makeImageFormData('image/png');
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', { method: 'POST', body: fd }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBeDefined();
    expect(body.rate_limit).toBeDefined();
  });

  it('returns 200 for jpeg image upload', async () => {
    const app = buildApp();
    const fd = makeImageFormData('image/jpeg');
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', { method: 'POST', body: fd }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
  });

  it('returns 400 when image field is missing', async () => {
    const app = buildApp();
    const fd = new FormData();
    fd.append('text', 'some text');
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', { method: 'POST', body: fd }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for unsupported mime type', async () => {
    const app = buildApp();
    const fd = makeImageFormData('application/pdf');
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', { method: 'POST', body: fd }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is not multipart/form-data', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64data' }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / 3600);
    const kv = makeKV({ [`rl:unknown:${window}`]: '1000' });
    const app = buildApp();
    const fd = makeImageFormData();
    const res = await app.fetch(
      new Request('http://localhost/api/check/image', { method: 'POST', body: fd }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
