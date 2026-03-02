import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('policy page images have alt attributes', async ({ page }) => {
    await page.goto('/policies/privacy');
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('policy page form inputs have associated labels', async ({ page }) => {
    await page.goto('/raport');
    const inputs = await page.locator('input:not([type="hidden"]), textarea, select').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      // Each input must have either an associated label, aria-label, or aria-labelledby
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        const hasAssociation = label > 0 || !!ariaLabel || !!ariaLabelledby;
        expect(hasAssociation).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledby).toBeTruthy();
      }
    }
  });

  test('/alerte page has proper heading structure', async ({ page }) => {
    await page.goto('/alerte');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('/policies/privacy page has exactly one h1', async ({ page }) => {
    await page.goto('/policies/privacy');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('/health endpoint responds without error', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
  });
});
