import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/admin-auth', () => ({
  adminAuth: vi.fn(async (c: any, next: any) => {
    c.set('adminEmail', 'test@admin.ro');
    return next();
  }),
}));

vi.mock('./weights', () => ({
  weightsAdmin: new Hono(),
}));

vi.mock('./translations', () => ({
  translationsAdmin: new Hono(),
}));

vi.mock('./config', () => ({
  configAdmin: new Hono(),
}));

vi.mock('./layout', () => ({
  adminLayout: vi.fn((title: string, content: string) => `<html>${title}${content}</html>`),
}));

vi.mock('./drafts', () => ({
  drafts: (() => {
    const r = new Hono();
    r.get('/', (c: any) => c.html('<html>Drafturi</html>'));
    return r;
  })(),
}));

// Mock campaigns module to avoid real DB calls in admin/index tests
vi.mock('./campaigns', () => ({
  campaignRoutes: (() => {
    const r = new Hono();
    r.get('/', (c: any) => c.html('<html>Campanii</html>'));
    return r;
  })(),
  campaignApiRoutes: new Hono(),
  scraperRoutes: (() => {
    const r = new Hono();
    r.get('/', (c: any) => c.html('<html>Scraper-e</html>'));
    return r;
  })(),
}));

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeEnv() {
  return {
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    DB: { prepare: vi.fn() },
    ADMIN_API_KEY: 'test-key',
  };
}

describe('admin/index', () => {
  it('GET / renders dashboard with adminEmail', { timeout: 15000 }, async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('test@admin.ro');
  });

  it('GET /campanii renders campaigns page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/campanii');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Campanii');
  });

  it('GET /drafturi renders drafts page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/drafturi');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Drafturi');
  });

  it('GET /scrapere renders scraper page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/scrapere');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Scraper');
  });

  it('GET /studio returns 503 when ASSETS is not bound', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/studio');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain('not available');
  });

  it('GET /studio returns 404 when studio/index.html is missing', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/studio');
    const envWithAssets = {
      ...makeEnv(),
      ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('', { status: 404 })) },
    };
    const res = await admin.fetch(req, envWithAssets, makeCtx());
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain('not deployed');
  });

  it('GET /studio/* returns 503 when ASSETS is not bound', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/studio/assets/main.js');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(503);
  });

  it('GET / sets Content-Security-Policy header on HTML responses', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://cdn.ai-grija.ro');
    expect(csp).toContain('https://cdn.tailwindcss.com');
  });
});
