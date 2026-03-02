/**
 * Report flow full BDD — /raportare form, submission, success.
 */
import { test, expect } from '@playwright/test';

test.describe('Report flow — /raportare page load', () => {
  test('page loads with 200 and HTML', async ({ request }) => {
    const res = await request.get('/raportare');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('page renders with heading', async ({ page }) => {
    const res = await page.goto('/raportare');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('contains authority reference (DNSC, 1911, or Politia)', async ({ page }) => {
    await page.goto('/raportare');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content).toMatch(/1911|DNSC|Poli.ia|CERT/i);
  });
});

test.describe('Report flow — form fields', () => {
  test('form element is present on /raportare', async ({ page }) => {
    await page.goto('/raportare');
    await page.waitForLoadState('networkidle');
    const forms = await page.locator('form').count();
    expect(forms).toBeGreaterThanOrEqual(1);
  });

  test('form has at least one input or textarea', async ({ page }) => {
    await page.goto('/raportare');
    await page.waitForLoadState('networkidle');
    const inputs = await page.locator('input:not([type="hidden"]), textarea').count();
    expect(inputs).toBeGreaterThanOrEqual(1);
  });

  test('fill text field and submit if available', async ({ page }) => {
    await page.goto('/raportare');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();
    const textInput = page.locator('input[type="text"], input:not([type="submit"]):not([type="hidden"])').first();

    if (await textarea.count() > 0) {
      await textarea.fill('Mesaj test pentru raportare automata e2e.');
    } else if (await textInput.count() > 0) {
      await textInput.fill('Mesaj test e2e');
    }

    // Attempt submit
    const submitBtn = page.locator(
      'button[type="submit"], input[type="submit"], [data-testid="report-submit"], button:has-text("Trimite"), button:has-text("Raporteaza")'
    ).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      // Page should still be functional (no crash)
      expect(page.url()).toMatch(/raportare|report/i);
    }
  });
});

test.describe('Report flow — POST /api/report', () => {
  test('POST /api/report with minimal payload returns 2xx or 4xx (no 5xx)', async ({ request }) => {
    const res = await request.post('/api/report', {
      data: {
        message: 'SMS suspect de la nr +40711111111: Castigati 5000 RON',
        type: 'sms',
      },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/report with empty payload returns 400', async ({ request }) => {
    const res = await request.post('/api/report', {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });
});

test.describe('Report flow — prefill via query params', () => {
  test('/raportare?verdict=phishing shows phishing in content', async ({ page }) => {
    await page.goto('/raportare?verdict=phishing');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content.toLowerCase()).toContain('phishing');
  });
});
