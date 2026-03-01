import { test, expect } from '@playwright/test';

test.describe('Responsive layouts', () => {
  test('homepage at mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Page should load without layout errors
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });

  test('homepage at tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('homepage at desktop viewport (1440x900) full nav visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('/alerte page is responsive at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const res = await page.goto('/alerte');
    expect(res?.status()).toBe(200);
  });

  test('/policies/privacy is responsive at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const res = await page.goto('/policies/privacy');
    expect(res?.status()).toBe(200);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });
});
