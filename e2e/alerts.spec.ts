import { test, expect } from '@playwright/test';

test.describe('Alerts page /alerte', () => {
  test('page loads with 200 and has campaign content', async ({ page }) => {
    const res = await page.goto('/alerte');
    expect(res?.status()).toBe(200);
    // Page should contain alert/campaign related content
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('GET /api/alerts returns campaigns array', async ({ request }) => {
    const res = await request.get('/api/alerts');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('GET /api/alerts?status=active returns filtered campaigns', async ({ request }) => {
    const res = await request.get('/api/alerts?status=active');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('GET /api/alerts?status=invalid returns 400', async ({ request }) => {
    const res = await request.get('/api/alerts?status=invalid');
    expect(res.status()).toBe(400);
  });

  test('/alerte page has correct content-type HTML', async ({ request }) => {
    const res = await request.get('/alerte', { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });
});
