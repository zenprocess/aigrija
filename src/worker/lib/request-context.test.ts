import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requestContext } from './request-context';
import { checkBudget } from './perf-budget';

function makeApp() {
  const app = new Hono();
  app.use('*', requestContext);
  app.get('/test', (c) => c.text('ok'));
  app.get('/api/check', (c) => c.text('check'));
  return app;
}

describe('requestContext middleware', () => {
  it('adds X-Request-Id header with UUID format', async () => {
    const app = makeApp();
    const res = await app.request('/test');
    const id = res.headers.get('X-Request-Id');
    expect(id).toBeDefined();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('adds X-Response-Time header as numeric string', async () => {
    const app = makeApp();
    const res = await app.request('/test');
    const rt = res.headers.get('X-Response-Time');
    expect(rt).toBeDefined();
    expect(Number(rt)).toBeGreaterThanOrEqual(0);
    expect(isNaN(Number(rt))).toBe(false);
  });

  it('each request gets unique X-Request-Id', async () => {
    const app = makeApp();
    const [r1, r2] = await Promise.all([app.request('/test'), app.request('/test')]);
    const id1 = r1.headers.get('X-Request-Id');
    const id2 = r2.headers.get('X-Request-Id');
    expect(id1).not.toBe(id2);
  });
});

describe('checkBudget', () => {
  it('returns exceeded=false when within budget', () => {
    const { exceeded, budget } = checkBudget('/api/check', 500);
    expect(exceeded).toBe(false);
    expect(budget).toBe(3000);
  });

  it('returns exceeded=true when over budget', () => {
    const { exceeded } = checkBudget('/api/check', 4000);
    expect(exceeded).toBe(true);
  });

  it('uses default budget for unknown endpoints', () => {
    const { exceeded, budget } = checkBudget('/unknown', 100);
    expect(exceeded).toBe(false);
    expect(budget).toBe(5000);
  });

  it('matches /api/alerts prefix', () => {
    const { budget } = checkBudget('/api/alerts', 100);
    expect(budget).toBe(500);
  });
});
