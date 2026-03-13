import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { BadgesEndpoint } from './openapi-badges';

function makeApp(env: any) {
  const app = new Hono();
  app.get('/api/badges', async (c) => {
    const endpoint = new BadgesEndpoint();
    return endpoint.handle(c as any);
  });
  return app;
}

function makeEnv(): any {
  return {};
}

describe('GET /api/badges', () => {
  it('returns badges data', async () => {
    const app = makeApp(makeEnv());
    const res = await app.fetch(new Request('http://localhost/api/badges'), makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verified_by).toBeDefined();
    expect(Array.isArray(body.data_sources)).toBe(true);
    expect(Array.isArray(body.certifications)).toBe(true);
  });

  it('includes expected badge fields', async () => {
    const app = makeApp(makeEnv());
    const res = await app.fetch(new Request('http://localhost/api/badges'), makeEnv(), {} as any);
    const body = await res.json() as any;
    expect(body.verified_by).toContain('Workers AI');
    expect(body.data_sources.length).toBeGreaterThan(0);
    expect(body.certifications).toContain('GDPR Compliant');
  });
});
