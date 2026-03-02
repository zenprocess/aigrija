import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index';

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

function makeEnv(kvStore?: Record<string, string>) {
  return {
    CACHE: makeKV(kvStore),
    ASSETS: { fetch: vi.fn() },
    BUTTONDOWN_API_KEY: 'test-api-key',
  };
}

const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;
/** Compute the KV key for the current fixed window. */
function rlKey(identifier: string, windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const windowSlot = Math.floor(now / windowSeconds);
  return `rl:${identifier}:${windowSlot}`;
}

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with confirmation message on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub_123', email: 'user@example.com' }), { status: 201 })
    ));

    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(body.message).toContain('email');
  });

  it('returns 400 for invalid email format', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing email field', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({}),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '9.9.9.9' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await app.fetch(req, makeEnv({ [rlKey('newsletter:9.9.9.9', 60)]: '5' }) as any, ctx);
    expect(res.status).toBe(429);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('returns 503 when BUTTONDOWN_API_KEY is not configured', async () => {
    const env = {
      CACHE: makeKV(),
      ASSETS: { fetch: vi.fn() },
    };

    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await app.fetch(req, env as any, ctx);
    expect(res.status).toBe(503);
  });
});

describe('POST /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 on successful unsubscribe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    ));

    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 404 when subscriber not found in Buttondown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found.' }), { status: 404 })
    ));

    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid email on unsubscribe', async () => {
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ email: 'bad-email' }),
    });

    const res = await app.fetch(req, makeEnv() as any, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit is exceeded for unsubscribe', async () => {
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '8.8.8.8' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await app.fetch(req, makeEnv({ [rlKey('newsletter:8.8.8.8', 60)]: '5' }) as any, ctx);
    expect(res.status).toBe(429);
  });
});
