import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { TranslationReportEndpoint } from './openapi-translation-report';

vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(),
  applyRateLimitHeaders: vi.fn(),
  getRouteRateLimit: vi.fn().mockReturnValue({ limit: 5, windowSeconds: 3600 }),
}));

import { createRateLimiter, applyRateLimitHeaders } from '../lib/rate-limiter';

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.post('/api/translation-report', async (c) => {
    const endpoint = new TranslationReportEndpoint();
    return endpoint.handle(c as any);
  });
  return app;
}

function makeEnv(): any {
  return {
    CACHE: { get: vi.fn(), put: vi.fn() },
  };
}

describe('POST /api/translation-report (TranslationReportEndpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRateLimiter).mockReturnValue(vi.fn().mockResolvedValue({ allowed: true, remaining: 4, limit: 5 } as any));
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(createRateLimiter).mockReturnValue(vi.fn().mockResolvedValue({ allowed: false, remaining: 0, limit: 5 } as any));
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/translation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'ro', comment: 'test' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 for missing comment', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/translation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'ro' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('MISSING_COMMENT');
  });

  it('returns 400 for missing lang', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/translation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'This is wrong text' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('MISSING_LANG');
  });

  it('returns 200 with id on happy path', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/translation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'ro', comment: 'The text is wrong', key: 'nav.home', page: '/acasa' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid JSON body', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/translation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(400);
  });
});
