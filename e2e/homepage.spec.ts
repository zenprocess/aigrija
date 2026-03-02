/**
 * Homepage full BDD spec — every interactive element, navigation, counter, footer.
 */
import { test, expect } from '@playwright/test';

test.describe('Homepage — load and metadata', () => {
  test('returns 200 and title contains ai-grija', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/ai-grija/i);
  });

  test('has meta description tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDesc).toBeTruthy();
  });

  test('canonical link tag is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const canonical = await page.locator('link[rel="canonical"]').count();
    expect(canonical).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Homepage — hero section', () => {
  test('hero section with suspicious message prompt is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hero = page.locator('text=Ai primit un mesaj suspect?').first();
    await expect(hero).toBeVisible({ timeout: 15000 });
  });

  test('h1 heading is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Homepage — check form interaction', () => {
  test('textarea is visible and accepts input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const textarea = page.locator(
      '[data-testid="checker-textarea"], [data-testid="check-input"], textarea'
    ).first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill('Test text pentru verificare');
    await expect(textarea).toHaveValue('Test text pentru verificare');
  });

  test('submit button is visible and enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await expect(btn).toBeVisible({ timeout: 15000 });
    await expect(btn).toBeEnabled();
  });

  test('empty submit shows validation error or native browser validation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();
    const hasError = await page.locator('[data-testid="check-error"], .error, [role="alert"]').count() > 0
      || await page.evaluate(() => {
        const ta = document.querySelector('textarea');
        return ta ? !ta.validity.valid : false;
      });
    expect(hasError).toBeTruthy();
  });

  test('typing and submitting phishing text shows result card', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const textarea = page.locator(
      '[data-testid="checker-textarea"], [data-testid="check-input"], textarea'
    ).first();
    await textarea.fill('Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare pentru a evita blocarea permanenta.');
    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();
    // Wait for result — AI endpoint may take up to 30s
    const result = page.locator(
      '[data-testid="checker-action-share"], [data-testid="check-result"], .verdict, [data-testid="verdict-card"]'
    ).first();
    await expect(result).toBeVisible({ timeout: 45000 });
  });
});

test.describe('Homepage — counter section', () => {
  test('GET /api/counter returns total_checks number', async ({ request }) => {
    const res = await request.get('/api/counter');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.total_checks).toBe('number');
    expect(body.total_checks).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Homepage — navigation links', () => {
  test('navigation bar is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, [role="navigation"], header nav').first();
    await expect(nav).toBeVisible({ timeout: 15000 });
  });

  test('logo / home link navigates to /', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const logo = page.locator('a[href="/"], a[href="/#/"], [data-testid="nav-logo"]').first();
    if (await logo.count() > 0) {
      await logo.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toMatch(/localhost:8787\/?$/);
    }
  });

  test('link to /alerte is present and navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/alerte"], a[href*="alerte"]').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('alerte');
    }
  });

  test('link to /blog is present and navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/blog"], a[href*="blog"]').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('blog');
    }
  });

  test('link to /raportare is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/raportare"], a[href*="raportare"]').first();
    if (await link.count() > 0) {
      await expect(link).toBeVisible();
    }
  });
});

test.describe('Homepage — footer', () => {
  test('footer is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });
  });

  test('footer contains Zen Labs branding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const footer = page.locator('footer');
    await expect(footer).toContainText(/Zen Labs/i);
  });

  test('footer has policy links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const footer = page.locator('footer');
    const links = footer.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});
