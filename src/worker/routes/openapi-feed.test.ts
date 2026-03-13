import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FeedEndpoint } from './openapi-feed';

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.get('/api/feed/latest', async (c) => {
    const endpoint = new FeedEndpoint();
    return endpoint.handle(c as any);
  });
  return app;
}

function makeEnv(feedData?: any[]): any {
  return {
    CACHE: {
      get: async () => feedData ? JSON.stringify(feedData) : null,
    },
  };
}

describe('GET /api/feed/latest (FeedEndpoint)', () => {
  it('returns empty array when no feed data', async () => {
    const app = makeApp();
    const res = await app.fetch(new Request('http://localhost/api/feed/latest'), makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('returns feed entries', async () => {
    const entries = [
      { verdict: 'phishing', scam_type: 'SMS Fraud', timestamp: 1700000000000 },
      { verdict: 'likely_safe', scam_type: 'Unknown', timestamp: 1700000001000 },
    ];
    const app = makeApp();
    const res = await app.fetch(new Request('http://localhost/api/feed/latest'), makeEnv(entries), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(2);
    expect(body[0].verdict).toBe('phishing');
  });

  it('limits to 5 entries', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      verdict: 'suspicious', scam_type: 'Test', timestamp: i,
    }));
    const app = makeApp();
    const res = await app.fetch(new Request('http://localhost/api/feed/latest'), makeEnv(entries), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(5);
  });
});
