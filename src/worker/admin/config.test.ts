import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { configAdmin } from './config';

function makeKV(data: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(data));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async (opts?: { prefix?: string; cursor?: string }) => ({
      keys: [...store.keys()]
        .filter(k => !opts?.prefix || k.startsWith(opts.prefix))
        .map(k => ({ name: k })),
      list_complete: true,
      cursor: '',
      cacheStatus: null,
    })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

function makeEnv(kvData: Record<string, string> = {}) {
  return {
    CACHE: makeKV(kvData),
    ADMIN_API_KEY: 'test-key',
    ADMIN_DB: null,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// Wrap configAdmin with a middleware that sets adminEmail
function makeApp() {
  const app = new Hono<{ Bindings: any; Variables: { adminEmail: string } }>();
  app.use('*', async (c, next) => {
    c.set('adminEmail', 'test@admin.ro');
    return next();
  });
  app.route('/', configAdmin);
  return app;
}

describe('configAdmin', () => {
  describe('GET /', () => {
    it('renders config page with feature flags', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/');
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Feature Flags');
      expect(html).toContain('Rate Limits');
      expect(html).toContain('Circuit Breakers');
    });
  });

  describe('POST /flag', () => {
    it('toggles a valid flag', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'dnsc_scraper', enabled: false }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
    });

    it('rejects invalid flag name', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'nonexistent', enabled: true }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('POST /ratelimit', () => {
    it('saves valid rate limit', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/ratelimit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'telegram', limit: 100 }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
    });

    it('rejects invalid endpoint', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/ratelimit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'invalid', limit: 50 }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('POST /circuit-reset', () => {
    it('resets valid circuit breaker', async () => {
      const app = makeApp();
      const env = makeEnv({ 'cb:safe-browsing': JSON.stringify({ state: 'open' }) });
      const req = new Request('http://localhost/circuit-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'safe-browsing' }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
    });

    it('rejects invalid circuit breaker', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/circuit-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'nonexistent' }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('POST /cache-flush', () => {
    it('flushes valid prefix', async () => {
      const app = makeApp();
      const env = makeEnv({ 'url-threat:abc': '1', 'url-threat:def': '2' });
      const req = new Request('http://localhost/cache-flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'url-threat:' }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.deleted).toBeGreaterThanOrEqual(0);
    });

    it('rejects invalid prefix', async () => {
      const app = makeApp();
      const env = makeEnv();
      const req = new Request('http://localhost/cache-flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'invalid:' }),
      });
      const res = await app.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });
});
