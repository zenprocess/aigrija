import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { StatsEndpoint } from './openapi-stats';

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.get('/api/stats', async (c) => {
    const endpoint = new StatsEndpoint();
    return endpoint.handle(c as any);
  });
  return app;
}

function makeEnv(kvStore: Record<string, string> = {}): any {
  return {
    CACHE: {
      get: async (key: string) => kvStore[key] ?? null,
    },
  };
}

describe('GET /api/stats (StatsEndpoint)', () => {
  it('returns zeros when no values stored', async () => {
    const app = makeApp();
    const res = await app.fetch(new Request('http://localhost/api/stats'), makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(0);
    expect(body.threats_detected).toBe(0);
    expect(body.active_campaigns).toBe(0);
  });

  it('returns stored stats values', async () => {
    const app = makeApp();
    const env = makeEnv({
      'stats:total_checks': '150',
      'stats:threats_detected': '42',
      'stats:active_campaigns': '7',
    });
    const res = await app.fetch(new Request('http://localhost/api/stats'), env, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(150);
    expect(body.threats_detected).toBe(42);
    expect(body.active_campaigns).toBe(7);
  });
});
