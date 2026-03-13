import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsletter } from './newsletter';

vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(),
  applyRateLimitHeaders: vi.fn(),
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

function allowedRateLimit() {
  vi.mocked(createRateLimiter).mockReturnValue(
    vi.fn().mockResolvedValue({ allowed: true, remaining: 4, limit: 5 }) as any
  );
}

function blockedRateLimit() {
  vi.mocked(createRateLimiter).mockReturnValue(
    vi.fn().mockResolvedValue({ allowed: false, remaining: 0, limit: 5 }) as any
  );
}

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
  });

  it('returns 429 when rate limited', async () => {
    blockedRateLimit();
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid JSON body', async () => {
    allowedRateLimit();
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('returns 400 for invalid email', async () => {
    allowedRateLimit();
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when API key is missing', async () => {
    allowedRateLimit();
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(''), {} as any);
    expect(res.status).toBe(503);
  });

  it('returns 200 on successful subscribe', async () => {
    allowedRateLimit();
    vi.mocked(withCircuitBreaker).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }) as any);
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 400 when Buttondown returns 400 (already subscribed)', async () => {
    allowedRateLimit();
    vi.mocked(withCircuitBreaker).mockResolvedValue(
      new Response('{}', { status: 400 }) as any
    );
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('returns 503 when circuit breaker is open', async () => {
    allowedRateLimit();
    vi.mocked(withCircuitBreaker).mockRejectedValue(new CircuitOpenError('open'));
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(503);
  });
});

describe('POST /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
  });

  it('returns 429 when rate limited', async () => {
    blockedRateLimit();
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(429);
  });

  it('returns 200 on successful unsubscribe', async () => {
    allowedRateLimit();
    vi.mocked(withCircuitBreaker).mockResolvedValue(new Response('', { status: 200 }) as any);
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 404 when email not subscribed', async () => {
    allowedRateLimit();
    vi.mocked(withCircuitBreaker).mockResolvedValue(new Response('', { status: 404 }) as any);
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(404);
  });

  it('returns 503 when API key is missing', async () => {
    allowedRateLimit();
    const req = new Request('http://localhost/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await newsletter.fetch(req, makeEnv(''), {} as any);
    expect(res.status).toBe(503);
  });
});
