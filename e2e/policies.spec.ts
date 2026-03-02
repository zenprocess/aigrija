import { test, expect } from '@playwright/test';

test.describe('Policy pages', () => {
  test('GET /policies/privacy returns 200 with Romanian content', async ({ request }) => {
    const res = await request.get('/policies/privacy');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('Politica de confiden');
  });

  test('GET /policies/general-terms returns 200 with terms content', async ({ request }) => {
    const res = await request.get('/policies/general-terms');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toMatch(/termeni|termen/);
  });

  test('GET /gdpr returns 200 with GDPR content', async ({ request }) => {
    const res = await request.get('/gdpr');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('GDPR');
  });

  test('GET /policies/privacy?lang=en returns translation disclaimer', async ({ request }) => {
    const res = await request.get('/policies/privacy?lang=en');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('This is a translation');
  });

  test('GET /policies/privacy has hreflang tags in head', async ({ page }) => {
    await page.goto('/policies/privacy');
    const hreflangCount = await page.locator('link[hreflang]').count();
    expect(hreflangCount).toBeGreaterThan(0);
  });

  test('Language switcher links are present', async ({ page }) => {
    await page.goto('/policies/privacy');
    // Look for language switcher links
    const langLinks = page.locator('.lang-switch a, [class*="lang"] a');
    const count = await langLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
