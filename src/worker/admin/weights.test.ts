import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('./layout', () => ({
  adminLayout: vi.fn((title: string, content: string) => `<html>${title}${content}</html>`),
}));

vi.mock('../lib/weights', async () => {
  const { DEFAULT_WEIGHTS } = await import('../lib/weights');
  return {
    DEFAULT_WEIGHTS,
    getWeights: vi.fn(async () => ({ ...DEFAULT_WEIGHTS })),
    saveWeights: vi.fn(async () => {}),
    getWeightHistory: vi.fn(async () => []),
    scoreUrlWithWeights: vi.fn((weights: any, flags: any) => ({
      score: 0.1,
      breakdown: {},
    })),
  };
});

function makeKV(): KVNamespace {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '', cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeEnv() {
  return { CACHE: makeKV(), ADMIN_API_KEY: 'test-key' };
}

function makeApp() {
  const app = new Hono<{ Bindings: any; Variables: { adminEmail: string } }>();
  app.use('*', async (c, next) => {
    c.set('adminEmail', 'test@admin.ro');
    return next();
  });
  return app;
}

describe('weightsAdmin', () => {
  beforeEach(() => vi.resetModules());

  it('GET / renders weights page', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/');
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Weights');
  });

  it('POST /save updates weights', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const form = new FormData();
    form.append('safeBrowsingMatch', '0.6');
    const req = new Request('http://localhost/save', { method: 'POST', body: form });
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('saved');
  });

  it('POST /reset redirects to /admin/weights', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/reset', { method: 'POST' });
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/admin/weights');
  });

  it('GET /test returns error for empty URL', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/test');
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Enter a URL');
  });

  it('GET /test returns error for invalid URL', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/test?url=%00');
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Invalid URL');
  });

  it('GET /test scores a valid URL', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/test?url=https%3A%2F%2Fexample.com');
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Score');
  });

  it('GET /history returns JSON', async () => {
    const { weightsAdmin } = await import('./weights');
    const app = makeApp();
    app.route('/', weightsAdmin);
    const req = new Request('http://localhost/history');
    const res = await app.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});
