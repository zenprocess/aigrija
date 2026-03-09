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
  it('GET / renders dashboard with adminEmail', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('test@admin.ro');
  });

  it('GET /campaigns renders campaigns page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/campaigns');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Campanii');
  });

  it('GET /drafts renders drafts page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/drafts');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Drafturi');
  });

  it('GET /scrapers renders scraper page', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/scrapers');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Scraper');
  });

  it('GET /campanii redirects 301 to /campaigns', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/campanii');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/campaigns');
  });

  it('GET /drafturi redirects 301 to /drafts', async () => {
    const { admin } = await import('./index');
    const req = new Request('http://localhost/drafturi');
    const res = await admin.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/drafts');
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
    expect(csp).not.toContain('cdn.tailwindcss.com');
  });
});
