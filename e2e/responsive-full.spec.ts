/**
 * Responsive regression — key pages at 375, 768, 1024, 1440px.
 * No horizontal overflow. Navigation adapts. Visual baselines.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

// Skip on mobile project — this suite manages its own viewports (375–1440px).
// Running under isMobile: true causes viewport/scrollbar inconsistencies.
test.skip(({ browserName }, testInfo) => testInfo.project.name === 'mobile', 'Viewport tests run on chromium only');

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

const PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'alerte', path: '/alerte' },
  { name: 'raportare', path: '/raportare' },
  { name: 'blog', path: '/blog' },
  { name: 'gdpr', path: '/gdpr' },
];

// ── No horizontal overflow ────────────────────────────────────────────────────

for (const bp of BREAKPOINTS) {
  for (const pg of PAGES) {
    test(`${pg.name} at ${bp.width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');

      const overflowWidth = await page.evaluate(() => document.body.scrollWidth);
      // Allow 4px tolerance for rounding
      expect(overflowWidth).toBeLessThanOrEqual(document.body.clientWidth + 4);
    });
  }
}

// ── Page renders at each breakpoint ──────────────────────────────────────────

for (const pg of PAGES) {
  test.describe(`${pg.name} responsive rendering`, () => {
    for (const bp of BREAKPOINTS) {
      test(`loads at ${bp.width}px without error`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        const res = await page.goto(pg.path);
        expect([200, 301, 302]).toContain(res?.status());
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
      });
    }
  });
}

// ── Navigation at mobile breakpoint ──────────────────────────────────────────

test.describe('Navigation adapts at mobile (375px)', () => {
  test('homepage navigation is accessible at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Either hamburger menu or full nav — just check no crash
    const nav = page.locator('nav, header, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 15000 });
  });

  test('hamburger button visible on mobile if nav is collapsible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator(
      '[data-testid="hamburger"], button[aria-label*="menu"], button[aria-label*="Menu"], .hamburger, [class*="menu-toggle"]'
    ).first();

    // Non-fatal: check if present and visible
    if (await hamburger.count() > 0) {
      await expect(hamburger).toBeVisible();
      await hamburger.click();
      await page.waitForTimeout(300);
      // Menu should expand
      const menu = page.locator('[data-testid="mobile-menu"], .mobile-menu, nav[aria-expanded="true"]').first();
      if (await menu.count() > 0) {
        await expect(menu).toBeVisible();
      }
    }
  });

  test('desktop nav hidden on mobile if breakpoint-driven', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const desktopNav = page.locator('[data-testid="desktop-nav"], .desktop-nav, .nav-desktop').first();
    if (await desktopNav.count() > 0) {
      await expect(desktopNav).not.toBeVisible();
    }
  });
});

// ── Visual baseline screenshots ───────────────────────────────────────────────

test.describe('Visual baselines', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const pg of PAGES) {
    test(`${pg.name} desktop baseline screenshot`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');
      // toMatchSnapshot stores in e2e/baselines automatically via Playwright snapshotDir
      await expect(page).toHaveScreenshot(`${pg.name}-desktop.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  }

  test('homepage mobile baseline screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('homepage tablet baseline screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
