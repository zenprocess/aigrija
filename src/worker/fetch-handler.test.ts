import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the fetch handler hostname routing in src/worker/index.ts.
 * Covers CDN host, admin host, /admin prefix stripping, and hostname case normalisation.
 */

// ── Hoisted spy so it can be referenced inside vi.mock factories ──────────────
const { mockCdnProtection } = vi.hoisted(() => {
  const fn = vi.fn(async (_c: unknown, next: () => Promise<void>) => next());
  return { mockCdnProtection: fn };
});

// ── Sentry: pass handler through unchanged so we can call .fetch() directly ───
vi.mock('@sentry/cloudflare', () => ({
  withSentry: (_getOptions: unknown, handler: unknown) => handler,
}));

// ── Admin: return a recognisable response embedding the path ──────────────────
vi.mock('./admin', async () => {
  const { Hono } = await import('hono');
  const adminApp = new Hono();
  adminApp.all('*', (c: any) => c.text(`admin-routed:${c.req.path}`, 200));
  return { admin: adminApp };
});

// ── CDN protection: spy that passes through to next handler ───────────────────
vi.mock('./middleware/cdn-protection', () => ({
  cdnProtection: mockCdnProtection,
}));

// Import AFTER mocks are registered (vi.mock is hoisted, so this is safe)
import workerHandler from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

async function dispatch(url: string, init?: RequestInit): Promise<Response> {
  const req = new Request(url, init);
  // After the Sentry mock, the default export is the raw ExportedHandler
  return (workerHandler as unknown as { fetch: (r: Request, e: unknown, c: ExecutionContext) => Promise<Response> })
    .fetch(req, {}, makeCtx());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fetch handler hostname routing', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // reset call counts; keeps implementations intact
  });

  // ── CDN host ─────────────────────────────────────────────────────────────

  it('fetch routes cdn host to CDN app', async () => {
    const res = await dispatch('https://cdn.ai-grija.ro/api/alerts');
    expect(mockCdnProtection).toHaveBeenCalledOnce();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });

  it('fetch routes pre-cdn host to CDN app', async () => {
    await dispatch('https://pre-cdn.ai-grija.ro/api/alerts');
    expect(mockCdnProtection).toHaveBeenCalledOnce();
  });

  it('fetch does NOT invoke cdnProtection for main host', async () => {
    await dispatch('https://ai-grija.ro/api/alerts');
    expect(mockCdnProtection).not.toHaveBeenCalled();
  });

  // ── Admin host ────────────────────────────────────────────────────────────

  it('fetch routes admin host to admin app', async () => {
    const res = await dispatch('https://admin.ai-grija.ro/dashboard');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('admin-routed:');
  });

  it('fetch routes pre-admin host to admin app', async () => {
    const res = await dispatch('https://pre-admin.ai-grija.ro/');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('admin-routed:');
  });

  // ── /admin prefix stripping ───────────────────────────────────────────────

  it('fetch strips /admin prefix when admin host has /admin path', async () => {
    const res = await dispatch('https://admin.ai-grija.ro/admin/users');
    expect(res.status).toBe(200);
    const text = await res.text();
    // /admin/users → /users after strip
    expect(text).toBe('admin-routed:/users');
  });

  it('fetch strips /admin prefix for localhost /admin route', async () => {
    const res = await dispatch('http://localhost/admin/settings');
    expect(res.status).toBe(200);
    const text = await res.text();
    // /admin/settings → /settings after strip
    expect(text).toBe('admin-routed:/settings');
  });

  it('fetch rewrites bare /admin to / when stripping prefix', async () => {
    const res = await dispatch('https://admin.ai-grija.ro/admin');
    expect(res.status).toBe(200);
    const text = await res.text();
    // /admin → / (fallback in replace expression)
    expect(text).toBe('admin-routed:/');
  });

  it('fetch routes localhost without /admin prefix to main app', async () => {
    const res = await dispatch('http://localhost/api/alerts');
    // localhost without /admin → main app; cdnProtection should NOT be called
    expect(mockCdnProtection).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  // ── Hostname case normalisation ───────────────────────────────────────────

  it('fetch normalizes hostname case — CDN host', async () => {
    // WHATWG URL standard lowercases hostnames; the handler must match
    const req = new Request('https://CDN.AI-GRIJA.RO/api/alerts');
    // Verify normalisation happened at the Request level
    expect(new URL(req.url).hostname).toBe('cdn.ai-grija.ro');
    // Route must reach CDN app
    await (workerHandler as any).fetch(req, {}, makeCtx());
    expect(mockCdnProtection).toHaveBeenCalledOnce();
  });

  it('fetch normalizes hostname case — admin host', async () => {
    const req = new Request('https://ADMIN.AI-GRIJA.RO/dashboard');
    expect(new URL(req.url).hostname).toBe('admin.ai-grija.ro');
    const res = await (workerHandler as any).fetch(req, {}, makeCtx());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('admin-routed:');
  });

  it('fetch normalizes hostname case — main host falls through to main app', async () => {
    const req = new Request('https://AI-GRIJA.RO/api/alerts');
    expect(new URL(req.url).hostname).toBe('ai-grija.ro');
    const res = await (workerHandler as any).fetch(req, {}, makeCtx());
    expect(mockCdnProtection).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
