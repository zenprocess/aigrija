import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  cspMiddleware,
  cspHtmlMiddleware,
  PUBLIC_CSP,
  ADMIN_CSP,
  SECURITY_HEADERS_ADMIN_CSP,
  SECURITY_HEADERS_PUBLIC_CSP,
} from './csp';

describe('cspMiddleware', () => {
  it('sets Content-Security-Policy on all responses', async () => {
    const app = new Hono();
    app.use('*', cspMiddleware(PUBLIC_CSP));
    app.get('/', (c) => c.text('ok'));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBe(PUBLIC_CSP);
  });

  it('uses the provided policy string', async () => {
    const custom = "default-src 'none'";
    const app = new Hono();
    app.use('*', cspMiddleware(custom));
    app.get('/', (c) => c.text('ok'));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBe(custom);
  });
});

describe('cspHtmlMiddleware', () => {
  it('sets CSP on HTML responses', async () => {
    const app = new Hono();
    app.use('*', cspHtmlMiddleware(ADMIN_CSP));
    app.get('/', (c) => c.html('<html>hi</html>'));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBe(ADMIN_CSP);
  });

  it('does NOT set CSP on JSON responses', async () => {
    const app = new Hono();
    app.use('*', cspHtmlMiddleware(ADMIN_CSP));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('does NOT set CSP on plain text responses', async () => {
    const app = new Hono();
    app.use('*', cspHtmlMiddleware(ADMIN_CSP));
    app.get('/', (c) => c.text('ok'));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });
});

describe('CSP policy constants', () => {
  it('PUBLIC_CSP contains expected directives', () => {
    expect(PUBLIC_CSP).toContain("default-src 'self'");
    expect(PUBLIC_CSP).toContain('https://cloud.umami.is');
    expect(PUBLIC_CSP).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('ADMIN_CSP contains expected directives', () => {
    expect(ADMIN_CSP).toContain("default-src 'self'");
    expect(ADMIN_CSP).not.toContain('cdn.tailwindcss.com');
    expect(ADMIN_CSP).toContain('https://unpkg.com');
    expect(ADMIN_CSP).toContain("frame-ancestors 'none'");
    expect(ADMIN_CSP).toContain('https://cdn.ai-grija.ro');
  });

  it('SECURITY_HEADERS_ADMIN_CSP contains CDN sources', () => {
    expect(SECURITY_HEADERS_ADMIN_CSP).not.toContain('cdn.tailwindcss.com');
    expect(SECURITY_HEADERS_ADMIN_CSP).toContain('unpkg.com');
    expect(SECURITY_HEADERS_ADMIN_CSP).toContain("base-uri 'self'");
  });

  it('SECURITY_HEADERS_PUBLIC_CSP does not contain CDN sources', () => {
    expect(SECURITY_HEADERS_PUBLIC_CSP).not.toContain('cdn.tailwindcss.com');
    expect(SECURITY_HEADERS_PUBLIC_CSP).toContain("default-src 'self'");
    expect(SECURITY_HEADERS_PUBLIC_CSP).toContain("base-uri 'self'");
  });
});
