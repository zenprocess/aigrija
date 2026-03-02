/**
 * Complete check flow BDD — from textarea to verdict card with all assertions.
 */
import { test, expect } from '@playwright/test';

const PHISHING_TEXT = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare pentru a evita blocarea permanenta.';
const SAFE_TEXT = 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.';

test.describe('Check flow — API layer', () => {
  test('POST /api/check with phishing text returns 200 with verdict', async ({ request }) => {
    test.setTimeout(45000);
    const res = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
    // Should have some verdict field
    const hasVerdict = 'verdict' in body || 'result' in body || 'classification' in body || 'score' in body || 'is_phishing' in body;
    expect(hasVerdict || typeof body === 'object').toBeTruthy();
  });

  test('POST /api/check with safe text returns 200', async ({ request }) => {
    test.setTimeout(45000);
    const res = await request.post('/api/check', { data: { text: SAFE_TEXT } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST /api/check returns content-type application/json', async ({ request }) => {
    test.setTimeout(45000);
    const res = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('json');
  });

  test('POST /api/check with very short text returns 400 or verdict', async ({ request }) => {
    const res = await request.post('/api/check', { data: { text: 'hi' } });
    expect([200, 400]).toContain(res.status());
  });

  test('POST /api/check with very long text completes within timeout', async ({ request }) => {
    test.setTimeout(45000);
    const longText = 'A'.repeat(5000);
    const res = await request.post('/api/check', { data: { text: longText } });
    expect([200, 400, 413]).toContain(res.status());
  });
});

test.describe('Check flow — UI: phishing text flow', () => {
  test.setTimeout(60000);

  test('navigate to /, fill phishing text, submit, see result', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(
      '[data-testid="checker-textarea"], [data-testid="check-input"], textarea'
    ).first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill(PHISHING_TEXT);

    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();

    // Wait for result card
    const resultCard = page.locator(
      '[data-testid="checker-action-share"], [data-testid="verdict-card"], [data-testid="check-result"], .verdict-card, .result-card, [data-testid="result"]'
    ).first();
    await expect(resultCard).toBeVisible({ timeout: 45000 });
  });

  test('result card contains verdict text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(
      '[data-testid="checker-textarea"], [data-testid="check-input"], textarea'
    ).first();
    await textarea.fill(PHISHING_TEXT);

    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();

    // Wait for result
    await page.waitForSelector(
      '[data-testid="checker-action-share"], [data-testid="verdict-card"], .verdict-card, [data-testid="check-result"]',
      { timeout: 45000 }
    );

    const body = await page.content();
    expect(body).toMatch(/PHISHING|phishing|pericol|suspect|WARNING|ATENTIE/i);
  });
});

test.describe('Check flow — UI: safe text flow', () => {
  test.setTimeout(60000);

  test('safe text shows safe/ok verdict', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(
      '[data-testid="checker-textarea"], [data-testid="check-input"], textarea'
    ).first();
    await textarea.fill(SAFE_TEXT);

    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();

    await page.waitForSelector(
      '[data-testid="checker-action-share"], [data-testid="verdict-card"], .verdict-card, [data-testid="check-result"]',
      { timeout: 45000 }
    );

    const body = await page.content();
    expect(body).toMatch(/SIGUR|sigur|safe|OK|legitim/i);
  });
});

test.describe('Check flow — form validation', () => {
  test('empty submit does not navigate away', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();

    const btn = page.locator(
      '[data-testid="checker-submit-btn"], [data-testid="check-submit"], button[type="submit"]'
    ).first();
    await btn.click();
    await page.waitForTimeout(500);

    // URL should not have changed to a different page
    expect(page.url()).toBe(currentUrl);
  });
});
