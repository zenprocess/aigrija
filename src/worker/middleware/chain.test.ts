import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { applyMiddleware } from './chain';

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
}));

function buildApp() {
  const app = new Hono<{ Bindings: any; Variables: any }>();
  applyMiddleware(app as any);
  app.get('/test', (c) => c.json({ ok: true }));
  app.get('/alerte/test', (c) => c.json({ ok: true }));
  app.get('/policies/test', (c) => c.json({ ok: true }));
  app.get('/api/test', (c) => c.json({ ok: true }));
  app.get('/error', () => { throw new Error('boom'); });
  return app;
}

const app = buildApp();

describe('applyMiddleware — X-Request-Id', () => {
  it('sets X-Request-Id header matching UUID format', async () => {
    const res = await app.request('/test');
    const rid = res.headers.get('X-Request-Id');
    expect(rid).toBeTruthy();
    expect(rid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates a unique request ID per request', async () => {
    const res1 = await app.request('/test');
    const res2 = await app.request('/test');
    expect(res1.headers.get('X-Request-Id')).not.toBe(res2.headers.get('X-Request-Id'));
  });
});

describe('applyMiddleware — logging middleware', () => {
  it('logs request_start on every request', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await app.request('/test');
    const found = logSpy.mock.calls.some(([msg]) =>
      typeof msg === 'string' && msg.includes('request_start')
    );
    expect(found).toBe(true);
    logSpy.mockRestore();
  });

  it('logs request_end with duration_ms after response', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await app.request('/test');
    const endMsg = logSpy.mock.calls
      .map(([msg]) => msg)
      .find((msg: string) => msg.includes('request_end'));
    expect(endMsg).toBeDefined();
    const parsed = JSON.parse(endMsg as string);
    expect(typeof parsed.duration_ms).toBe('number');
    logSpy.mockRestore();
  });
});

describe('applyMiddleware — error handler', () => {
  it('returns HTML for text/html Accept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/error', {
      headers: { Accept: 'text/html' },
    });
    expect(res.status).toBe(500);
    const ct = res.headers.get('Content-Type') ?? '';
    expect(ct).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    vi.restoreAllMocks();
  });

  it('returns JSON for application/json Accept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/error', {
      headers: { Accept: 'application/json' },
    });
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.request_id).toMatch(/^[0-9a-f]{8}-/);
    vi.restoreAllMocks();
  });

  it('returns JSON by default (no Accept header)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/error');
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error.code).toBe('INTERNAL_ERROR');
    vi.restoreAllMocks();
  });
});

describe('applyMiddleware — CSP routing', () => {
  it('sets Content-Security-Policy on /alerte/* routes', async () => {
    const res = await app.request('/alerte/test');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://cloud.umami.is');
  });

  it('sets Content-Security-Policy on /policies/* routes', async () => {
    const res = await app.request('/policies/test');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
  });

  it('does not apply PUBLIC_CSP to non-SSR routes', async () => {
    const res = await app.request('/test');
    const csp = res.headers.get('Content-Security-Policy');
    // secureHeaders() may set a CSP, but it won't contain the Umami analytics URL
    if (csp) {
      expect(csp).not.toContain('https://cloud.umami.is');
    }
  });
});
