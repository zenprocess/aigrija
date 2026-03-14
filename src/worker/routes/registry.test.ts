import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { registerRoutes } from './registry';

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
  return {
    get: async () => null,
    put: vi.fn(),
    delete: vi.fn(),
    head: async () => null,
    list: async () => ({ objects: [], truncated: false }),
  } as unknown as R2Bucket;
}

function makeAI() {
  return {
    run: vi.fn().mockResolvedValue({
      response: JSON.stringify({
        verdict: 'likely_safe',
        confidence: 0.8,
        scam_type: 'None',
        red_flags: [],
        explanation: 'Looks safe.',
        recommended_actions: [],
      }),
    }),
  } as any;
}

function makeAssets(): Fetcher {
  return {
    fetch: vi.fn().mockResolvedValue(new Response('not found', { status: 404 })),
  } as unknown as Fetcher;
}

function makeD1(): D1Database {
  return {
    prepare: () => ({
      first: async () => ({ 1: 1 }),
      run: vi.fn(), all: vi.fn(), raw: vi.fn(), bind: vi.fn(),
    }),
    exec: vi.fn(), batch: vi.fn(), dump: vi.fn(),
  } as unknown as D1Database;
}

function makeQueue(): Queue {
  return { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    STORAGE: makeR2(),
    AI: makeAI(),
    ASSETS: makeAssets(),
    DB: makeD1(),
    DRAFT_QUEUE: makeQueue(),
    BASE_URL: 'http://localhost',
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  registerRoutes(app);
  return app;
}

describe('registerRoutes', () => {
  it('registers /health endpoint that returns 200', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/health'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
  });

  it('registers /api/counter endpoint that returns 200', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/counter'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBeDefined();
  });

  it('registers /api/quiz endpoint that returns 200', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.questions)).toBe(true);
  });

  it('registers /favicon.ico that returns 200 with image/x-icon', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/favicon.ico'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/x-icon');
  });

  it('registers /sw.js that returns a service worker script', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/sw.js'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
    const text = await res.text();
    expect(text).toContain('skipWaiting');
  });

  it('returns 404 for unknown static file extension', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/does-not-exist.jpg'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(404);
  });

  it('/api/v1/health returns same status and body as /api/health (v1 alias)', async () => {
    const app = buildApp();
    const env = makeEnv();
    const ctx = makeCtx();
    const v1Res = await app.fetch(new Request('http://localhost/api/v1/health'), env, ctx);
    const baseRes = await app.fetch(new Request('http://localhost/api/health'), env, ctx);
    expect(v1Res.status).toBe(200);
    expect(v1Res.status).toBe(baseRes.status);
    const v1Body = await v1Res.json() as any;
    const baseBody = await baseRes.json() as any;
    expect(v1Body.status).toBe(baseBody.status);
  });

  it('/api/v1/alerts returns same status as /api/alerts (v1 alias)', async () => {
    const app = buildApp();
    const env = makeEnv();
    const ctx = makeCtx();
    const v1Res = await app.fetch(new Request('http://localhost/api/v1/alerts'), env, ctx);
    const baseRes = await app.fetch(new Request('http://localhost/api/alerts'), env, ctx);
    expect(v1Res.status).toBe(200);
    expect(v1Res.status).toBe(baseRes.status);
  });

  it('registers /api/health/metrics endpoint that returns 200', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/health/metrics'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uptime_ms).toBeDefined();
    expect(body.bindings).toBeDefined();
  });
});
