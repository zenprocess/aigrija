import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import type { Env } from '../lib/types';
import { CheckQrEndpoint } from './openapi-check-qr';

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

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    GOOGLE_SAFE_BROWSING_KEY: undefined,
    VIRUSTOTAL_API_KEY: undefined,
    URLHAUS_AUTH_KEY: undefined,
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.post('/api/check-qr', CheckQrEndpoint);
  return honoApp;
}

async function post(app: ReturnType<typeof buildApp>, body: unknown, env: any) {
  return app.fetch(
    new Request('http://localhost/api/check-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    makeCtx()
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ matches: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  ));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/check-qr', () => {
  it('returns 200 with url_analysis for a valid URL', async () => {
    const app = buildApp();
    const res = await post(app, { qr_data: 'https://example.com' }, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url_analysis).toBeDefined();
    expect(body.url_analysis.url).toBe('https://example.com');
    expect(body.rate_limit).toBeDefined();
  });

  it('returns 200 with is_suspicious field in url_analysis', async () => {
    const app = buildApp();
    const res = await post(app, { qr_data: 'https://example.com' }, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.url_analysis.is_suspicious).toBe('boolean');
    expect(typeof body.url_analysis.risk_score).toBe('number');
    expect(Array.isArray(body.url_analysis.flags)).toBe(true);
  });

  it('returns 422 when qr_data is not a URL', async () => {
    const app = buildApp();
    const res = await post(app, { qr_data: 'not-a-url-just-text' }, makeEnv());
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error.code).toBe('INVALID_QR');
    expect(body.is_url).toBe(false);
  });

  it('returns 422 when qr_data uses non-http protocol', async () => {
    const app = buildApp();
    const res = await post(app, { qr_data: 'ftp://example.com/file' }, makeEnv());
    expect(res.status).toBe(422);
  });

  it('returns 400 when qr_data is missing', async () => {
    const app = buildApp();
    const res = await post(app, {}, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid JSON body', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/check-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{{{',
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
    const res = await post(app, { qr_data: 'https://example.com' }, makeEnv({ CACHE: kv }));
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
