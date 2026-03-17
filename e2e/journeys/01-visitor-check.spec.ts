/**
 * Journey 1 — First-Time Visitor flow
 *
 * Simulates a visitor arriving at the homepage, watching the terminal animation,
 * seeing the counter, entering a suspicious message, submitting it, and reading
 * the verdict card. Hits the real AI endpoint so may be slow.
 *
 * Results written to e2e/results/01-visitor.json
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUSPICIOUS_TEXT =
  'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify-fake.com/deblocare pentru a evita blocarea permanenta.';

const RESULTS_PATH = path.join(__dirname, '..', 'results', '01-visitor.json');

test.describe('Journey 1 — First-Time Visitor', () => {
  test.setTimeout(90000);

  test('visitor checks a suspicious message end-to-end', async ({ page, request }) => {
    const isMobile = test.info().project.name === 'mobile';
    const results: Record<string, unknown> = {
      journey: '01-visitor-check',
      timestamp: new Date().toISOString(),
      steps: {},
    };
    const steps = results.steps as Record<string, unknown>;

    // Capture the /api/check response when it fires from the UI
    let capturedCheck: Record<string, unknown> | null = null;
    await page.route('**/api/check', async route => {
      const response = await route.fetch();
      try {
        capturedCheck = await response.json();
      } catch {
        // ignore parse errors
      }
      await route.fulfill({ response });
    });

    // Step 1: Navigate to / and wait for hero terminal animation (5s)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(isMobile ? 7000 : 5000);
    steps['1_navigation'] = 'ok';

    // Step 2: Verify counter shows a number (not loading text)
    const counterRes = await request.get('/api/counter');
    expect(counterRes.status()).toBe(200);
    const counterBody = await counterRes.json();
    expect(typeof counterBody.total_checks).toBe('number');
    steps['2_counter'] = { total_checks: counterBody.total_checks };

    // Step 3: Scroll to checker form, verify textarea visible
    const textarea = page
      .locator('[data-testid="checker-textarea"], textarea')
      .first();
    await textarea.scrollIntoViewIfNeeded();
    await expect(textarea).toBeVisible({ timeout: 10000 });
    steps['3_textarea_visible'] = 'ok';

    // Step 4: Type a suspicious message into the textarea
    await textarea.fill(SUSPICIOUS_TEXT);
    await expect(textarea).toHaveValue(SUSPICIOUS_TEXT);
    steps['4_message_typed'] = 'ok';

    // Step 5: Click the submit/check button
    const submitBtn = page
      .locator('[data-testid="checker-submit-btn"], button[type="submit"]')
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();
    steps['5_submitted'] = 'ok';

    // Step 6: Wait up to 45s for verdict card to appear (real AI endpoint may be slow)
    await page.waitForSelector(
      '[data-testid="verdict-card"], [data-testid="checker-action-share"]',
      { timeout: 45000 },
    );
    steps['6_verdict_appeared'] = 'ok';

    // Steps 7–8: Verify verdict and confidence from the captured API response.
    // Fall back to a direct API call if the interceptor didn't fire.
    if (!capturedCheck) {
      const checkRes = await request.post('/api/check', {
        data: { text: SUSPICIOUS_TEXT },
      });
      expect(checkRes.status()).toBe(200);
      capturedCheck = await checkRes.json();
    }

    const classification =
      (capturedCheck as Record<string, unknown>).classification as
        | Record<string, unknown>
        | undefined;

    const verdict = classification?.verdict ?? capturedCheck?.verdict ?? capturedCheck?.result;
    expect(['phishing', 'suspicious', 'likely_safe']).toContain(verdict);
    steps['7_verdict'] = verdict;

    const confidence = classification?.confidence ?? capturedCheck?.confidence;
    expect(typeof confidence).toBe('number');
    steps['8_confidence'] = confidence;

    results.passed = true;

    // Write results
    fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  });
});
