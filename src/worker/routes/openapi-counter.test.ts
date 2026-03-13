import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { CounterEndpoint } from './openapi-counter';

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.get('/api/counter', async (c) => {
    const endpoint = new CounterEndpoint();
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

describe('GET /api/counter (CounterEndpoint)', () => {
  it('returns 0 when no value stored', async () => {
    const app = makeApp();
    const env = makeEnv();
    const res = await app.fetch(new Request('http://localhost/api/counter'), env, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(0);
  });

  it('returns stored count', async () => {
    const app = makeApp();
    const env = makeEnv({ 'stats:total_checks': '99' });
    const res = await app.fetch(new Request('http://localhost/api/counter'), env, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(99);
  });

  it('handles non-numeric stored value gracefully', async () => {
    const app = makeApp();
    const env = makeEnv({ 'stats:total_checks': 'invalid' });
    const res = await app.fetch(new Request('http://localhost/api/counter'), env, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(0);
  });
});
