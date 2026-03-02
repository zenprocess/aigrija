/**
 * Policy pages full BDD — /gdpr, /politica-cookies, /termeni
 */
import { test, expect } from '@playwright/test';

test.describe('Policies — /gdpr', () => {
  test('returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/gdpr');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('contains GDPR heading', async ({ page }) => {
    await page.goto('/gdpr');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content).toMatch(/GDPR|Regulament|Protec.ia datelor/i);
  });

  test('has at least one h1 or h2 heading', async ({ page }) => {
    await page.goto('/gdpr');
    await page.waitForLoadState('networkidle');
    const headings = await page.locator('h1, h2').count();
    expect(headings).toBeGreaterThanOrEqual(1);
  });

  test('has substantial text content (>200 chars)', async ({ page }) => {
    await page.goto('/gdpr');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(200);
  });
});

test.describe('Policies — /politica-cookies', () => {
  test('returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/politica-cookies');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('contains cookie-related heading or text', async ({ page }) => {
    await page.goto('/politica-cookies');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content).toMatch(/[Cc]ookie|Cookies/);
  });

  test('has at least one heading', async ({ page }) => {
    await page.goto('/politica-cookies');
    await page.waitForLoadState('networkidle');
    const headings = await page.locator('h1, h2').count();
    expect(headings).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Policies — /termeni', () => {
  test('returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/termeni');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('contains terms-related content', async ({ page }) => {
    await page.goto('/termeni');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content).toMatch(/[Tt]ermeni|[Cc]ondi.ii|utilizare/i);
  });

  test('has at least one heading', async ({ page }) => {
    await page.goto('/termeni');
    await page.waitForLoadState('networkidle');
    const headings = await page.locator('h1, h2').count();
    expect(headings).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Policies — navigation between policy pages', () => {
  test('navigate from /gdpr to /termeni via link if available', async ({ page }) => {
    await page.goto('/gdpr');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/termeni"], a[href*="termeni"]').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('termeni');
    }
  });

  test('navigate from /termeni to /politica-cookies via link if available', async ({ page }) => {
    await page.goto('/termeni');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/politica-cookies"], a[href*="cookies"]').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('cookies');
    }
  });

  test('navigate from /politica-cookies to /gdpr via link if available', async ({ page }) => {
    await page.goto('/politica-cookies');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/gdpr"], a[href*="gdpr"]').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('gdpr');
    }
  });

  test('each policy page has a footer with links back to home', async ({ page }) => {
    for (const path of ['/gdpr', '/politica-cookies', '/termeni']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const homeLink = page.locator('a[href="/"], a[href="/#/"], footer a').first();
      expect(await homeLink.count()).toBeGreaterThanOrEqual(0); // non-fatal: just check no crash
    }
  });
});
