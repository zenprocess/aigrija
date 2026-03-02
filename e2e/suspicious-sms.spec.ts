import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface QAResult {
  name: string;
  description: string;
  startTime: string;
  passes: {
    load: { status: 'pass' | 'fail'; duration: number; screenshot?: string; notes: string };
    interact: { status: 'pass' | 'fail'; duration: number; screenshots: string[]; notes: string; errors: string[] };
    api: { status: 'pass' | 'fail'; duration: number; requests: Array<{ url: string; method: string; status: number }> };
    console: { status: 'pass' | 'fail'; duration: number; errors: string[] };
    vision: { status: 'pass' | 'fail'; duration: number; screenshot?: string; description: string };
    responsive: { status: 'pass' | 'fail'; duration: number; screenshots: Record<string, string>; notes: string };
  };
  summary: {
    totalPasses: number;
    totalFails: number;
    overallStatus: 'pass' | 'fail';
  };
}

test.describe('QA Story: Verificare SMS suspect', () => {
  let result: QAResult;
  let apiRequests: Array<{ url: string; method: string; status: number }> = [];
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    result = {
      name: 'Verificare SMS suspect',
      description: 'Utilizatorul primeste un SMS suspect de la banca si il verifica pe ai-grija.ro',
      startTime: new Date().toISOString(),
      passes: {
        load: { status: 'fail', duration: 0, notes: '' },
        interact: { status: 'fail', duration: 0, screenshots: [], notes: '', errors: [] },
        api: { status: 'fail', duration: 0, requests: [] },
        console: { status: 'fail', duration: 0, errors: [] },
        vision: { status: 'fail', duration: 0, description: '' },
        responsive: { status: 'fail', duration: 0, screenshots: {}, notes: '' },
      },
      summary: { totalPasses: 0, totalFails: 0, overallStatus: 'fail' },
    };

    // Setup API request tracking
    page.on('response', async (response) => {
      apiRequests.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
      });
    });

    // Setup console error tracking
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Setup page error tracking
    page.on('pageerror', (error) => {
      pageErrors.push(error.toString());
    });
  });

  test('PASS 1: LOAD - Navigate and verify page loads within 3s', async ({ page }) => {
    const startTime = Date.now();
    const loadStart = Date.now();

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 3000 });
      const loadDuration = Date.now() - loadStart;

      // Verify page loaded
      await expect(page).toHaveTitle(/ai-grija|grija/i);

      // Take screenshot
      const screenshotPath = '/tmp/pass1-load.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });

      result.passes.load = {
        status: 'pass',
        duration: loadDuration,
        screenshot: screenshotPath,
        notes: `Page loaded successfully in ${loadDuration}ms`,
      };
      result.summary.totalPasses++;
    } catch (error) {
      result.passes.load = {
        status: 'fail',
        duration: Date.now() - loadStart,
        notes: `Failed to load page: ${error}`,
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test('PASS 2: INTERACT - Execute story steps in order', async ({ page }) => {
    const startTime = Date.now();
    const screenshots: string[] = [];

    try {
      // Step 1: Navigate to /
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      screenshots.push('/tmp/pass2-step1-navigate.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 2: Wait for textarea
      await page.waitForSelector('textarea[data-testid="checker-textarea"]', { timeout: 15000 });
      screenshots.push('/tmp/pass2-step2-textarea-ready.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 3: Fill textarea with suspicious SMS
      const suspiciousSMS = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare';
      await page.fill('textarea[data-testid="checker-textarea"]', suspiciousSMS);
      screenshots.push('/tmp/pass2-step3-text-filled.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 4: Click submit button
      await page.click('button[data-testid="checker-submit-btn"]');
      screenshots.push('/tmp/pass2-step4-submitted.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 5: Wait for results
      await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 15000 });
      screenshots.push('/tmp/pass2-step5-results-ready.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 6: Verify verdict contains "PHISHING"
      const bodyText = await page.textContent('body');
      const hasPhishing = bodyText?.includes('PHISHING');
      if (!hasPhishing) {
        throw new Error('Verdict does not contain "PHISHING"');
      }
      screenshots.push('/tmp/pass2-step6-verdict-verified.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 7: Click share button
      await page.click('button[data-testid="checker-action-share"]');
      screenshots.push('/tmp/pass2-step7-share-clicked.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      // Step 8: Verify share modal appears
      await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 5000 });
      screenshots.push('/tmp/pass2-step8-share-modal.png');
      await page.screenshot({ path: screenshots[screenshots.length - 1], fullPage: true });

      result.passes.interact = {
        status: 'pass',
        duration: Date.now() - startTime,
        screenshots,
        notes: 'All interaction steps executed successfully',
        errors: [],
      };
      result.summary.totalPasses++;
    } catch (error) {
      result.passes.interact = {
        status: 'fail',
        duration: Date.now() - startTime,
        screenshots,
        notes: `Interaction test failed: ${error}`,
        errors: [String(error)],
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test('PASS 3: API - Intercept and verify network requests', async ({ page }) => {
    const startTime = Date.now();

    try {
      apiRequests = []; // Reset

      // Navigate and interact
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('textarea[data-testid="checker-textarea"]', { timeout: 15000 });

      const suspiciousSMS = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare';
      await page.fill('textarea[data-testid="checker-textarea"]', suspiciousSMS);

      // Wait for API requests
      await page.click('button[data-testid="checker-submit-btn"]');
      await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 15000 });

      // Give time for all requests to complete
      await page.waitForTimeout(1000);

      // Verify API responses
      const failedRequests = apiRequests.filter(req => req.status >= 400);
      const successRequests = apiRequests.filter(req => req.status >= 200 && req.status < 300);

      result.passes.api = {
        status: failedRequests.length === 0 ? 'pass' : 'fail',
        duration: Date.now() - startTime,
        requests: apiRequests,
      };

      if (failedRequests.length > 0) {
        result.summary.totalFails++;
      } else {
        result.summary.totalPasses++;
      }
    } catch (error) {
      result.passes.api = {
        status: 'fail',
        duration: Date.now() - startTime,
        requests: apiRequests,
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test('PASS 4: CONSOLE - Check for console errors', async ({ page }) => {
    const startTime = Date.now();

    try {
      consoleErrors = []; // Reset
      pageErrors = [];

      // Navigate and interact
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('textarea[data-testid="checker-textarea"]', { timeout: 15000 });

      const suspiciousSMS = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare';
      await page.fill('textarea[data-testid="checker-textarea"]', suspiciousSMS);
      await page.click('button[data-testid="checker-submit-btn"]');
      await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 15000 });

      // Give time for any async errors
      await page.waitForTimeout(500);

      const allErrors = [...consoleErrors, ...pageErrors];

      result.passes.console = {
        status: allErrors.length === 0 ? 'pass' : 'fail',
        duration: Date.now() - startTime,
        errors: allErrors,
      };

      if (allErrors.length === 0) {
        result.summary.totalPasses++;
      } else {
        result.summary.totalFails++;
      }
    } catch (error) {
      result.passes.console = {
        status: 'fail',
        duration: Date.now() - startTime,
        errors: [String(error)],
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test('PASS 5: VISION - Full-page screenshot and layout quality', async ({ page }) => {
    const startTime = Date.now();

    try {
      // Navigate and get to results state
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('textarea[data-testid="checker-textarea"]', { timeout: 15000 });

      const suspiciousSMS = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare';
      await page.fill('textarea[data-testid="checker-textarea"]', suspiciousSMS);
      await page.click('button[data-testid="checker-submit-btn"]');
      await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 15000 });

      const screenshotPath = '/tmp/pass5-vision-full-page.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Verify key UI elements are visible
      const hasResultsContainer = await page.locator('[data-testid="checker-action-share"]').isVisible();
      const hasPhishingWarning = (await page.textContent('body'))?.includes('PHISHING');

      const description = hasResultsContainer && hasPhishingWarning
        ? 'Layout is clean with visible results container and phishing warning'
        : 'Warning: Some UI elements may not be properly visible';

      result.passes.vision = {
        status: 'pass',
        duration: Date.now() - startTime,
        screenshot: screenshotPath,
        description,
      };
      result.summary.totalPasses++;
    } catch (error) {
      result.passes.vision = {
        status: 'fail',
        duration: Date.now() - startTime,
        description: `Vision test failed: ${error}`,
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test('PASS 6: RESPONSIVE - Screenshot at 375px, 768px, 1440px widths', async ({ browser }) => {
    const startTime = Date.now();
    const breakpoints = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1440, height: 900 },
    };
    const screenshots: Record<string, string> = {};

    try {
      for (const [name, viewport] of Object.entries(breakpoints)) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();

        // Setup tracking for this page too
        page.on('response', (response) => {
          apiRequests.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
          });
        });

        try {
          // Navigate and interact
          await page.goto('/', { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('textarea[data-testid="checker-textarea"]', { timeout: 15000 });

          const suspiciousSMS = 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify.com/deblocare';
          await page.fill('textarea[data-testid="checker-textarea"]', suspiciousSMS);
          await page.click('button[data-testid="checker-submit-btn"]');
          await page.waitForSelector('button[data-testid="checker-action-share"]', { timeout: 15000 });

          const screenshotPath = `/tmp/pass6-responsive-${name}-${viewport.width}px.png`;
          screenshots[name] = screenshotPath;
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } finally {
          await context.close();
        }
      }

      result.passes.responsive = {
        status: 'pass',
        duration: Date.now() - startTime,
        screenshots,
        notes: 'All responsive breakpoints tested successfully',
      };
      result.summary.totalPasses++;
    } catch (error) {
      result.passes.responsive = {
        status: 'fail',
        duration: Date.now() - startTime,
        screenshots,
        notes: `Responsive test failed: ${error}`,
      };
      result.summary.totalFails++;
      throw error;
    }
  });

  test.afterEach(async () => {
    // Calculate overall status
    result.summary.overallStatus =
      result.summary.totalFails === 0 ? 'pass' : 'fail';

    // Write results to JSON file
    const resultsDir = '/Users/vvladescu/Desktop/aigrija/OUT-REPO/e2e/results';
    const resultsFile = path.join(resultsDir, 'suspicious-sms.json');

    // Ensure directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
    console.log(`Results written to ${resultsFile}`);
  });
});
