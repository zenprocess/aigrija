/**
 * Blog pages full BDD — list, article detail, navigation.
 */
import { test, expect } from '@playwright/test';

test.describe('Blog — /ghid list page', () => {
  test('returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/ghid');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('renders in browser with heading', async ({ page }) => {
    const res = await page.goto('/ghid');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('article list or empty state is visible', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('article, .post, .blog-post, li a, [data-testid="blog-item"]').count() > 0
      || await page.locator('main, section').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('content has substantial text', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(50);
  });
});

test.describe('Blog — article detail page', () => {
  test('first article link navigates to detail page', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');

    // Find a link to an article
    const articleLink = page.locator('article a, .post a, a[href*="/ghid/"]').first();
    if (await articleLink.count() === 0) {
      test.skip(true, 'No article links found on blog list');
      return;
    }

    const href = await articleLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'Article link has no href');
      return;
    }

    await articleLink.click();
    await page.waitForLoadState('networkidle');

    // Should be on a blog detail page
    const url = page.url();
    expect(url).toMatch(/ghid\//);
  });

  test('direct GET /ghid/:slug returns 200 or 404', async ({ request }) => {
    // Try a common slug pattern
    const res = await request.get('/ghid/test-article');
    expect([200, 404]).toContain(res.status());
  });

  test('article detail has title and content if it exists', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');

    const articleLink = page.locator('article a, .post a, a[href*="/ghid/"]').first();
    if (await articleLink.count() === 0) {
      test.skip(true, 'No articles to navigate to');
      return;
    }

    await articleLink.click();
    await page.waitForLoadState('networkidle');

    // Should have a heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should have body text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });
});

test.describe('Blog — navigation', () => {
  test('back to blog list via browser history', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');

    const articleLink = page.locator('article a, .post a, a[href*="/ghid/"]').first();
    if (await articleLink.count() === 0) {
      test.skip(true, 'No articles');
      return;
    }

    await articleLink.click();
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('ghid');
  });

  test('back link on article page if present', async ({ page }) => {
    await page.goto('/ghid');
    await page.waitForLoadState('networkidle');

    const articleLink = page.locator('article a, .post a, a[href*="/ghid/"]').first();
    if (await articleLink.count() === 0) {
      test.skip(true, 'No articles');
      return;
    }

    await articleLink.click();
    await page.waitForLoadState('networkidle');

    const backLink = page.locator('a[href="/ghid"], [data-testid="back-btn"], a:has-text("napoi"), a:has-text("Blog")').first();
    if (await backLink.count() > 0) {
      await backLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('ghid');
    }
  });
});
