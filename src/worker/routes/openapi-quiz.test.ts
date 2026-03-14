import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import type { Env } from '../lib/types';
import { QuizEndpoint, QuizCheckEndpoint } from './openapi-quiz';

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
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.get('/api/quiz', QuizEndpoint);
  openapi.post('/api/quiz/check', QuizCheckEndpoint);
  return honoApp;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/quiz', () => {
  it('returns 200 with questions array', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.questions)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeLessThanOrEqual(10);
  });

  it('returns questions for default ro lang when no lang param', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.lang).toBe('ro');
  });

  it('returns questions for en lang when lang=en param', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz?lang=en'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.lang).toBe('en');
  });

  it('sanitizes questions — no is_scam or red_flags in real_sau_frauda', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz'),
      makeEnv(),
      makeCtx()
    );
    const body = await res.json() as any;
    for (const q of body.questions) {
      if (q.type === 'real_sau_frauda') {
        expect(q.is_scam).toBeUndefined();
        expect(q.red_flags).toBeUndefined();
        expect(q.explanation).toBeUndefined();
      }
    }
  });

  it('returns 429 when rate limited', async () => {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / 3600);
    const kv = makeKV({ [`rl:quiz:unknown:${window}`]: '999' });
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz'),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/quiz/check', () => {
  it('returns 200 with correct/incorrect for real_sau_frauda question', async () => {
    const app = buildApp();
    // q1 is 'real_sau_frauda' with is_scam: true
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'q1', answer: true }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.correct).toBe(true);
    expect(body.explanation).toBeDefined();
  });

  it('returns false when answer is wrong for real_sau_frauda', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'q1', answer: false }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.correct).toBe(false);
  });

  it('returns 404 when questionId does not exist', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'nonexistent-id-xyz', answer: true }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when questionId is missing', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: true }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for invalid JSON body', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / 3600);
    const kv = makeKV({ [`rl:quiz-check:unknown:${window}`]: '1000' });
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'q1', answer: true }),
      }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
  });
});
