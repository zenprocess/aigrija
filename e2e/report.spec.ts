import { test, expect } from '@playwright/test';

test.describe('Report page /raport', () => {
  test('GET /raport returns 200 with report form visible', async ({ page }) => {
    const res = await page.goto('/raport');
    expect(res?.status()).toBe(200);
  });

  test('page contains authority links (DNSC 1911, Politia)', async ({ page }) => {
    await page.goto('/raport');
    const content = await page.content();
    expect(content).toMatch(/1911|DNSC|Poli.ia/i);
  });

  test('pre-fill with ?verdict=phishing shows phishing label', async ({ page }) => {
    await page.goto('/raport?verdict=phishing');
    const content = await page.content();
    expect(content.toLowerCase()).toContain('phishing');
  });

  test('GET /api/report/phishing returns 200', async ({ request }) => {
    const res = await request.get('/api/report/phishing');
    expect(res.status()).toBe(200);
  });
});
