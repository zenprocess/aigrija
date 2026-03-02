import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Error pages', () => {
  test('navigating to a non-existent page shows branded 404', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-xyz');
    expect(res?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    // Status code displayed on page
    await expect(page.getByText('404')).toBeVisible();
  });

  test('404 page contains an SVG avatar element', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    const svgCount = await page.locator('svg').count();
    expect(svgCount).toBeGreaterThanOrEqual(1);
  });

  test('404 page has a home link', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test('404 page passes axe-core accessibility audit', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
