import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  DigestLatestEndpoint,
  DigestSubscribeEndpoint,
  DigestUnsubscribeEndpoint,
} from './openapi-digest';

vi.mock('../lib/weekly-digest', () => ({
  generateWeeklyDigest: vi.fn(),
}));
vi.mock('../lib/logger', () => ({ structuredLog: vi.fn() }));
vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(),
  applyRateLimitHeaders: vi.fn(),
  getRouteRateLimit: vi.fn().mockReturnValue({ limit: 5, windowSeconds: 3600 }),
}));
vi.mock('../lib/gdpr-consent', () => ({
  recordConsent: vi.fn().mockResolvedValue(undefined),
  revokeConsent: vi.fn().mockResolvedValue(undefined),
}));

import { generateWeeklyDigest } from '../lib/weekly-digest';
import { createRateLimiter } from '../lib/rate-limiter';

const MOCK_DIGEST = {
  weekOf: '2024-01-01',
  topScams: [],
  stats: { totalChecks: 0, totalAlerts: 0, quizCompletions: 0, communityReports: 0 },
  blogPosts: [],
  tips: [],
};

function makeEnv(apiKey = 'bd-key'): any {
  return { BUTTONDOWN_API_KEY: apiKey, CACHE: null };
}

function makeCtx(): any {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
}

// ── DigestLatestEndpoint ──────────────────────────────────────────────────────

describe('GET /api/digest/latest (DigestLatestEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new DigestLatestEndpoint();
    app.get('/api/digest/latest', (c) => endpoint.handle(c as any));
    return app;
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 with ok:true and digest on success', async () => {
    vi.mocked(generateWeeklyDigest).mockResolvedValue(MOCK_DIGEST as any);
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/latest'),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.digest).toBeDefined();
  });

  it('returns 503 with ok:false when generateWeeklyDigest throws', async () => {
    vi.mocked(generateWeeklyDigest).mockRejectedValue(new Error('DB error'));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/latest'),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.ok).toBe(false);
  });

  it('sets Cache-Control header on success', async () => {
    vi.mocked(generateWeeklyDigest).mockResolvedValue(MOCK_DIGEST as any);
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/latest'),
      makeEnv(), makeCtx()
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

// ── DigestSubscribeEndpoint ───────────────────────────────────────────────────

describe('POST /api/digest/subscribe (DigestSubscribeEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new DigestSubscribeEndpoint();
    app.post('/api/digest/subscribe', (c) => endpoint.handle(c as any));
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRateLimiter).mockReturnValue(
      vi.fn().mockResolvedValue({ allowed: true, remaining: 4, limit: 5 }) as any
    );
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 422 for invalid email', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 503 when API key is missing', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(''), makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('returns 200 on successful Buttondown subscribe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '1' }), { status: 201 })
    ));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 400 when Buttondown returns 400 (already subscribed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{}', { status: 400 })
    ));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(400);
  });
});

// ── DigestUnsubscribeEndpoint ─────────────────────────────────────────────────

describe('POST /api/digest/unsubscribe (DigestUnsubscribeEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new DigestUnsubscribeEndpoint();
    app.post('/api/digest/unsubscribe', (c) => endpoint.handle(c as any));
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRateLimiter).mockReturnValue(
      vi.fn().mockResolvedValue({ allowed: true, remaining: 4, limit: 5 }) as any
    );
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 422 for invalid email', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 503 when API key is missing', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(''), makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('returns 200 on successful unsubscribe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 200 })
    ));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 404 when subscriber not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 404 })
    ));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(404);
  });
});
