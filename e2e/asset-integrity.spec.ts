/**
 * Asset integrity tests — favicon, logo, brand colors.
 */
import { test, expect } from '@playwright/test';

test.describe('Asset integrity — favicon', () => {
  test('GET /favicon.ico returns valid icon with image content-type', async ({ request }) => {
    const res = await request.get('/favicon.ico');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/^image\//);
  });
});

test.describe('Asset integrity — logo', () => {
  test('homepage contains a logo image', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const logo = page.locator(
      'img[alt*="logo" i], img[src*="logo" i], [data-testid="nav-logo"] img'
    ).first();
    await expect(logo).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Asset integrity — brand colors', () => {
  test('primary brand CSS custom properties are defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const colors = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      // Collect all CSS custom properties that look like color/brand vars
      const props: Record<string, string> = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
              for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style[i];
                if (name.startsWith('--')) {
                  props[name] = rule.style.getPropertyValue(name).trim();
                }
              }
            }
          }
        } catch {
          // cross-origin stylesheets — skip
        }
      }
      // Also check computed style for common brand variable patterns
      const candidates = ['--primary', '--brand', '--accent', '--color-primary', '--brand-primary'];
      for (const c of candidates) {
        const val = style.getPropertyValue(c).trim();
        if (val) props[c] = val;
      }
      return props;
    });
    const keys = Object.keys(colors);
    expect(keys.length).toBeGreaterThan(0);
  });
});
