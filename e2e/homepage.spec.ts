import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('returns 200 and page title contains ai-grija', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/ai-grija/i);
  });

  test('hero section visible with suspicious message text', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('text=Ai primit un mesaj suspect?').first();
    await expect(hero).toBeVisible();
  });

  test('input textarea and submit button are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('textarea[data-testid="check-input"], textarea').first()).toBeVisible();
    await expect(page.locator('button[data-testid="check-submit"], button[type="submit"]').first()).toBeVisible();
  });

  test('counter section shows a number from /api/counter', async ({ page, request }) => {
    const res = await request.get('/api/counter');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.total_checks).toBe('number');
  });

  test('footer contains Zen Labs', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText(/Zen Labs/i);
  });
});
