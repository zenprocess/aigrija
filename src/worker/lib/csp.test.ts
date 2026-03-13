import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  cspMiddleware,
  cspHtmlMiddleware,
  cspNonceMiddleware,
  generateNonce,
  buildCspWithNonce,
  PUBLIC_CSP,
  ADMIN_CSP,
  SECURITY_HEADERS_ADMIN_CSP,
  SECURITY_HEADERS_PUBLIC_CSP,
  type CspVariables,
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

describe('generateNonce', () => {
  it('returns a non-empty string', () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('returns a different value on each call', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe('buildCspWithNonce', () => {
  it('replaces unsafe-inline in script-src with nonce value', () => {
    const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    const result = buildCspWithNonce(policy, 'test-nonce');
    expect(result).toContain("script-src 'self' 'nonce-test-nonce'");
  });

  it('does NOT replace unsafe-inline in style-src', () => {
    const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    const result = buildCspWithNonce(policy, 'abc123');
    expect(result).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('leaves policy unchanged when script-src has no unsafe-inline', () => {
    const result = buildCspWithNonce(PUBLIC_CSP, 'abc123');
    // PUBLIC_CSP has no unsafe-inline in script-src — policy should be unchanged
    expect(result).toBe(PUBLIC_CSP);
  });

  it('works with ADMIN_CSP replacing unsafe-inline in script-src only', () => {
    const nonce = 'nonce-value';
    const result = buildCspWithNonce(ADMIN_CSP, nonce);
    expect(result).toContain(`'nonce-${nonce}'`);
    expect(result).not.toContain("script-src 'self' 'unsafe-inline'");
    // style-src unsafe-inline should remain
    expect(result).toContain("style-src 'self' 'unsafe-inline'");
  });
});

describe('cspNonceMiddleware', () => {
  it('sets CSP header with nonce on HTML responses', async () => {
    const app = new Hono<{ Variables: CspVariables }>();
    app.use('*', cspNonceMiddleware(ADMIN_CSP));
    app.get('/', (c) => c.html('<html>hi</html>'));

    const res = await app.request('/');
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).not.toBe('');
    expect(csp).toContain("'nonce-");
    // script-src should no longer have unsafe-inline
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('stores nonce in context and sets matching CSP header', async () => {
    const app = new Hono<{ Variables: CspVariables }>();
    app.use('*', cspNonceMiddleware(ADMIN_CSP));
    let capturedNonce: string | undefined;
    app.get('/', (c) => {
      capturedNonce = c.get('cspNonce');
      return c.html('<html>hi</html>');
    });

    const res = await app.request('/');
    expect(capturedNonce).toBeDefined();
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain(`'nonce-${capturedNonce}'`);
  });

  it('does NOT set CSP on JSON responses', async () => {
    const app = new Hono<{ Variables: CspVariables }>();
    app.use('*', cspNonceMiddleware(ADMIN_CSP));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('generates a different nonce per request', async () => {
    const app = new Hono<{ Variables: CspVariables }>();
    app.use('*', cspNonceMiddleware(ADMIN_CSP));
    const nonces: string[] = [];
    app.get('/', (c) => {
      nonces.push(c.get('cspNonce'));
      return c.html('<html>hi</html>');
    });

    await app.request('/');
    await app.request('/');
    expect(nonces[0]).not.toBe(nonces[1]);
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
    expect(ADMIN_CSP).toContain('https://cdn.tailwindcss.com');
    expect(ADMIN_CSP).toContain("frame-ancestors 'none'");
    expect(ADMIN_CSP).toContain('https://cdn.ai-grija.ro');
  });

  it('SECURITY_HEADERS_ADMIN_CSP contains CDN sources', () => {
    expect(SECURITY_HEADERS_ADMIN_CSP).toContain('cdn.tailwindcss.com');
    expect(SECURITY_HEADERS_ADMIN_CSP).toContain('unpkg.com');
    expect(SECURITY_HEADERS_ADMIN_CSP).toContain("base-uri 'self'");
  });

  it('SECURITY_HEADERS_PUBLIC_CSP does not contain CDN sources', () => {
    expect(SECURITY_HEADERS_PUBLIC_CSP).not.toContain('cdn.tailwindcss.com');
    expect(SECURITY_HEADERS_PUBLIC_CSP).toContain("default-src 'self'");
    expect(SECURITY_HEADERS_PUBLIC_CSP).toContain("base-uri 'self'");
  });
});
