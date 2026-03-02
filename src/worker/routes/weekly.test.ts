import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { weekly } from './weekly';

function makeKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// ─── Buttondown fetch mock helpers ────────────────────────────────────────────

function mockFetch(status: number, body: unknown = { ok: true }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('GET /api/weekly', () => {
  it('returns 200', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/weekly'), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it('returns ok:true with items array', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/weekly'), makeEnv(), makeCtx());
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe('POST /api/digest/subscribe', () => {
  it('returns 422 for invalid email', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 503 when BUTTONDOWN_API_KEY missing', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv({ CACHE: makeKV() }),
      makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('subscribes valid email via Buttondown and returns 200', async () => {
    mockFetch(201, { email: 'user@example.com' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when Buttondown returns 400 (already subscribed)', async () => {
    mockFetch(400, { error: 'already subscribed' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('sends digest tag to Buttondown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.tags).toContain('digest');
  });
});

describe('POST /api/digest/unsubscribe', () => {
  it('returns 422 for invalid email', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 503 when BUTTONDOWN_API_KEY missing', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV() }),
      makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('unsubscribes email via Buttondown and returns 200', async () => {
    mockFetch(204);
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 404 when Buttondown returns 404', async () => {
    mockFetch(404);
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'notsubscribed@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(404);
  });
});
