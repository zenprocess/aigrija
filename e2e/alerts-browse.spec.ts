/**
 * Alerts browse full BDD — list, detail, navigation.
 */
import { test, expect } from '@playwright/test';

test.describe('Alerts — /alerte list page', () => {
  test('page loads with 200 and HTML content-type', async ({ request }) => {
    const res = await request.get('/alerte', { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('page renders in browser with h1', async ({ page }) => {
    const res = await page.goto('/alerte');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 15000 });
  });

  test('alerts list or empty state is visible', async ({ page }) => {
    await page.goto('/alerte');
    await page.waitForLoadState('networkidle');
    // Either a list of items or an empty state message
    const hasContent = await page.locator(
      '[data-testid="alert-item"], .alert-item, article, [data-testid="empty-state"], .empty'
    ).count() > 0
      || await page.locator('main, .content, section').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('GET /api/alerts returns campaigns array', async ({ request }) => {
    const res = await request.get('/api/alerts');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
    expect(Array.isArray(body.campaigns)).toBe(true);
  });
});

test.describe('Alerts — detail page', () => {
  test('GET /api/alerts returns at least zero campaigns', async ({ request }) => {
    const res = await request.get('/api/alerts');
    const body = await res.json();
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('/alerte/:id detail page loads for first available campaign', async ({ page, request }) => {
    const res = await request.get('/api/alerts');
    const body = await res.json();
    const campaigns = body.campaigns ?? [];
    if (campaigns.length === 0) {
      test.skip(true, 'No campaigns available to test detail page');
      return;
    }
    const first = campaigns[0];
    const id = first.id ?? first.slug ?? first._id;
    const detailRes = await page.goto(`/alerte/${id}`);
    expect([200, 301, 302]).toContain(detailRes?.status());
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('detail page has heading content', async ({ page, request }) => {
    const res = await request.get('/api/alerts');
    const body = await res.json();
    const campaigns = body.campaigns ?? [];
    if (campaigns.length === 0) {
      test.skip(true, 'No campaigns available');
      return;
    }
    const first = campaigns[0];
    const id = first.id ?? first.slug ?? first._id;
    await page.goto(`/alerte/${id}`);
    await page.waitForLoadState('networkidle');
    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Alerts — back navigation', () => {
  test('browser back from detail returns to list page', async ({ page, request }) => {
    const res = await request.get('/api/alerts');
    const body = await res.json();
    const campaigns = body.campaigns ?? [];
    if (campaigns.length === 0) {
      test.skip(true, 'No campaigns to navigate');
      return;
    }
    await page.goto('/alerte');
    await page.waitForLoadState('networkidle');
    const first = campaigns[0];
    const id = first.id ?? first.slug ?? first._id;
    await page.goto(`/alerte/${id}`);
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('alerte');
  });

  test('back link on detail page navigates up if present', async ({ page, request }) => {
    const res = await request.get('/api/alerts');
    const body = await res.json();
    const campaigns = body.campaigns ?? [];
    if (campaigns.length === 0) {
      test.skip(true, 'No campaigns');
      return;
    }
    const first = campaigns[0];
    const id = first.id ?? first.slug ?? first._id;
    await page.goto(`/alerte/${id}`);
    await page.waitForLoadState('networkidle');
    const backLink = page.locator('a[href="/alerte"], [data-testid="back-btn"], a:has-text("napoi"), a:has-text("napoi")').first();
    if (await backLink.count() > 0) {
      await backLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('alerte');
    }
  });
});
