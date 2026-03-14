import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { VoteEndpoint } from './openapi-vote';

vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(),
  applyRateLimitHeaders: vi.fn(),
  getRouteRateLimit: vi.fn().mockReturnValue({ limit: 10, windowSeconds: 60 }),
}));

import { createRateLimiter, applyRateLimitHeaders } from '../lib/rate-limiter';

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.post('/api/reports/:id/vote', async (c) => {
    const endpoint = new VoteEndpoint();
    return endpoint.handle(c as any);
  });
  return app;
}

function makeEnv(kvStore: Record<string, string> = {}): any {
  return {
    CACHE: {
      get: async (key: string) => kvStore[key] ?? null,
      put: async (key: string, value: string) => { kvStore[key] = value; },
    },
  };
}

describe('POST /api/reports/:id/vote (VoteEndpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRateLimiter).mockReturnValue(vi.fn().mockResolvedValue({ allowed: true, remaining: 9, limit: 10 } as any));
    vi.mocked(applyRateLimitHeaders).mockImplementation(() => {});
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(createRateLimiter).mockReturnValue(vi.fn().mockResolvedValue({ allowed: false, remaining: 0, limit: 10 } as any));
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports/abc/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'up' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(429);
  });

  it('returns 404 when report not found', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports/nonexistent/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'up' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid vote direction', async () => {
    const store = { 'report:report1': JSON.stringify({ id: 'report1', votes_up: 0, votes_down: 0 }) };
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports/report1/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'sideways' }),
      }),
      makeEnv(store), {} as any
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('INVALID_VOTE');
  });

  it('increments votes_up', async () => {
    const store: Record<string, string> = {
      'report:report1': JSON.stringify({ id: 'report1', text_snippet: 'test', votes_up: 2, votes_down: 1, created_at: '', verdict: 'phishing' }),
    };
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports/report1/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'up' }),
      }),
      makeEnv(store), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.votes_up).toBe(3);
    expect(body.votes_down).toBe(1);
  });

  it('increments votes_down', async () => {
    const store: Record<string, string> = {
      'report:report1': JSON.stringify({ id: 'report1', text_snippet: 'test', votes_up: 2, votes_down: 1, created_at: '', verdict: 'phishing' }),
    };
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/api/reports/report1/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'down' }),
      }),
      makeEnv(store), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.votes_up).toBe(2);
    expect(body.votes_down).toBe(2);
  });
});
