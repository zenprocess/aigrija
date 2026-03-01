import { test, expect } from '@playwright/test';

test.describe('GET /health', () => {
  test('returns 200 with status ok or degraded', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('response has version, timestamp, and checks fields', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('checks');
  });

  test('checks field contains kv, ai, and r2 entries', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks).toHaveProperty('kv');
    expect(body.checks).toHaveProperty('ai');
    expect(body.checks).toHaveProperty('r2');
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});
