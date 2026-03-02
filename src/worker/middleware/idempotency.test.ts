import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { idempotency } from './idempotency';

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    _store: store,
  };
}

function makeApp(kv: ReturnType<typeof makeKV>) {
  const app = new Hono<{ Bindings: { CACHE: typeof kv } }>();

  app.post('/api/test', idempotency(), async (c) => {
    return c.json({ ok: true, ts: Date.now() });
  });

  app.post('/api/error', idempotency(), async (c) => {
    return c.json({ error: 'bad input' }, 400);
  });

  app.post('/api/server-error', idempotency(), async (c) => {
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}

describe('idempotency middleware', () => {
  let kv: ReturnType<typeof makeKV>;
  let app: ReturnType<typeof makeApp>;

  const ctx = {
    waitUntil: vi.fn((p: Promise<unknown>) => p),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    kv = makeKV();
    app = makeApp(kv);
    vi.clearAllMocks();
  });

  it('passes through requests without Idempotency-Key header', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/test', { method: 'POST' }),
      { CACHE: kv },
      ctx,
    );
    expect(res.status).toBe(200);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('executes handler and stores response for new idempotency key', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'key-abc-123' },
      }),
      { CACHE: kv },
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    // Should have attempted to store
    expect(kv.put).toHaveBeenCalledOnce();
    const [putKey] = kv.put.mock.calls[0];
    expect(putKey).toMatch(/^idem:[0-9a-f]{64}$/);
  });

  it('returns cached response on replay with same key', async () => {
    // Prime the cache manually
    const cached = JSON.stringify({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, cached: true }),
    });
    kv._store.set('idem:replayed', cached);
    // Override get to return for any key that ends in the right hash
    kv.get.mockImplementation(async (_key: string, type?: string) => {
      const val = kv._store.get(_key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    });

    // Pre-populate with the actual hash of 'replay-key'
    const keyHash = await sha256Hex('replay-key');
    const kvKey = `idem:${keyHash}`;
    kv._store.set(kvKey, cached);

    const res = await app.fetch(
      new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'replay-key' },
      }),
      { CACHE: kv },
      ctx,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Idempotency-Replayed')).toBe('true');
    const body = await res.json();
    expect(body).toMatchObject({ cached: true });
    // Handler should NOT have been called again (no new put)
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('caches 4xx responses', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/error', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'err-key' },
      }),
      { CACHE: kv },
      ctx,
    );
    expect(res.status).toBe(400);
    expect(kv.put).toHaveBeenCalledOnce();
  });

  it('does NOT cache 5xx responses', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/server-error', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'srv-err-key' },
      }),
      { CACHE: kv },
      ctx,
    );
    expect(res.status).toBe(500);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('two different keys produce independent cache entries', async () => {
    await app.fetch(
      new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'key-1' },
      }),
      { CACHE: kv },
      ctx,
    );
    await app.fetch(
      new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'key-2' },
      }),
      { CACHE: kv },
      ctx,
    );
    expect(kv.put).toHaveBeenCalledTimes(2);
    const key1 = kv.put.mock.calls[0][0];
    const key2 = kv.put.mock.calls[1][0];
    expect(key1).not.toBe(key2);
  });
});

// Helper duplicated here so the test file is self-contained
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
