import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { securityHeaders } from './security-headers';

function makeApp(url: string) {
  const app = new Hono();
  app.use('*', securityHeaders());
  app.get('*', (c) => c.text('ok'));
  return app;
}

describe('securityHeaders middleware', () => {
  it('sets X-Content-Type-Options', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('sets Content-Security-Policy (non-admin)', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('cdn.tailwindcss.com');
  });

  it('sets admin Content-Security-Policy for admin. URLs', async () => {
    const app = makeApp('https://admin.ai-grija.ro/');
    const res = await app.request('https://admin.ai-grija.ro/');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).not.toContain('cdn.tailwindcss.com');
    expect(csp).toContain('unpkg.com');
  });

  it('adds CORS headers for allowed origin', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/', {
      headers: { Origin: 'https://ai-grija.ro' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ai-grija.ro');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('does NOT add CORS headers for disallowed origin', async () => {
    const app = makeApp('https://ai-grija.ro/');
    const res = await app.request('https://ai-grija.ro/', {
      headers: { Origin: 'https://evil.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
