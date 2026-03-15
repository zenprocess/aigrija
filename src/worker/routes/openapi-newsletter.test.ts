import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  NewsletterSubscribeEndpoint,
  NewsletterUnsubscribeEndpoint,
} from './openapi-newsletter';

vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(),
  applyRateLimitHeaders: vi.fn(),
  getRouteRateLimit: vi.fn().mockReturnValue({ limit: 5, windowSeconds: 120 }),
}));
vi.mock('../lib/gdpr-consent', () => ({
  recordConsent: vi.fn().mockResolvedValue(undefined),
  revokeConsent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/circuit-breaker', () => ({
  withCircuitBreaker: vi.fn(),
  CircuitOpenError: class CircuitOpenError extends Error {},
}));

import { createRateLimiter, applyRateLimitHeaders } from '../lib/rate-limiter';
import { withCircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker';

function makeEnv(apiKey = 'bd-key'): any {
  return {
    BUTTONDOWN_API_KEY: apiKey,
    CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
  };
}

function makeCtx(): any {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
}

function allowRateLimit() {
  vi.mocked(createRateLimiter).mockReturnValue(
    vi.fn().mockResolvedValue({ allowed: true, remaining: 4, limit: 5 }) as any
  );
}

function blockRateLimit() {
  vi.mocked(createRateLimiter).mockReturnValue(
    vi.fn().mockResolvedValue({ allowed: false, remaining: 0, limit: 5 }) as any
  );
}

// ── NewsletterSubscribeEndpoint ───────────────────────────────────────────────

describe('POST /api/newsletter/subscribe (NewsletterSubscribeEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new NewsletterSubscribeEndpoint();
    app.post('/api/newsletter/subscribe', (c) => endpoint.handle(c as any));
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
    allowRateLimit();
  });

  it('returns 429 when rate limited', async () => {
    blockRateLimit();
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for invalid email', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
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
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(''), makeCtx()
    );
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.error.code).toBe('MISCONFIGURED');
  });

  it('returns 200 on successful subscribe', async () => {
    vi.mocked(withCircuitBreaker).mockResolvedValue(
      new Response(JSON.stringify({ id: '1' }), { status: 201 }) as any
    );
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
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

  it('returns 400 when already subscribed (Buttondown 400)', async () => {
    vi.mocked(withCircuitBreaker).mockResolvedValue(
      new Response('{}', { status: 400 }) as any
    );
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('returns 503 when circuit breaker is open', async () => {
    vi.mocked(withCircuitBreaker).mockRejectedValue(new CircuitOpenError('open'));
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

// ── NewsletterUnsubscribeEndpoint ─────────────────────────────────────────────

describe('POST /api/newsletter/unsubscribe (NewsletterUnsubscribeEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new NewsletterUnsubscribeEndpoint();
    app.post('/api/newsletter/unsubscribe', (c) => endpoint.handle(c as any));
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
    allowRateLimit();
  });

  it('returns 429 when rate limited', async () => {
    blockRateLimit();
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid email', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 503 when API key is missing', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(''), makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('returns 200 on successful unsubscribe', async () => {
    vi.mocked(withCircuitBreaker).mockResolvedValue(
      new Response('', { status: 200 }) as any
    );
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/unsubscribe', {
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

  it('returns 404 when email is not subscribed', async () => {
    vi.mocked(withCircuitBreaker).mockResolvedValue(
      new Response('', { status: 404 }) as any
    );
    const res = await makeApp().fetch(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv(), makeCtx()
    );
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
