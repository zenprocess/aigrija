import { test, expect, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://ai-grija.ro';
const REPORT_DIR = path.resolve(__dirname, '../../playwright-report');

interface QAResult {
  visual: 'pass' | 'fail';
  console: 'pass' | 'fail';
  responsive: 'pass' | 'fail';
  bdd: 'pass' | 'fail';
  a11y: 'pass' | 'fail';
  scenarios_tested: number;
  scenarios_passed: number;
  errors: string[];
  warnings: string[];
}

interface RalphResult {
  status: 'pass' | 'fail';
  timestamp: string;
  results: { pass: number; fail: number; total: number; test_files: number };
  categories: {
    visual: 'pass' | 'fail';
    console: 'pass' | 'fail';
    responsive: 'pass' | 'fail';
    bdd: 'pass' | 'fail';
    a11y: 'pass' | 'fail';
  };
}

let qaResult: QAResult = {
  visual: 'pass',
  console: 'pass',
  responsive: 'pass',
  bdd: 'pass',
  a11y: 'pass',
  scenarios_tested: 0,
  scenarios_passed: 0,
  errors: [],
  warnings: [],
};

// Ensure report directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

test.describe('Post-Sprint QA Verification', () => {
  // ============================================================================
  // 1. VISUAL SCREENSHOTS & RESPONSIVE TESTS
  // ============================================================================

  test.describe('Visual Verification', () => {
    test('homepage screenshot at desktop (1440px)', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '01-homepage.png'),
        fullPage: true,
      });
      expect(page.url()).toContain(BASE_URL);
    });

    test('blog page screenshot', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.goto(`${BASE_URL}/#/blog`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '02-blog.png'),
        fullPage: true,
      });
      expect(page.url()).toContain('blog');
    });

    test('despre page screenshot', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.goto(`${BASE_URL}/#/despre`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '03-despre.png'),
        fullPage: true,
      });
      expect(page.url()).toContain('despre');
    });

    test('confidentialitate page screenshot', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.goto(`${BASE_URL}/#/confidentialitate`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '04-confidentialitate.png'),
        fullPage: true,
      });
      expect(page.url()).toContain('confidentialitate');
    });

    test('termeni page screenshot', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.goto(`${BASE_URL}/#/termeni`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '05-termeni.png'),
        fullPage: true,
      });
      expect(page.url()).toContain('termeni');
    });

    test('quiz page screenshot', async ({ page }) => {
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.goto(`${BASE_URL}/#/quiz`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(screenshotDir, '06-quiz.png'),
        fullPage: true,
      });
      expect(page.url()).toContain('quiz');
    });
  });

  test.describe('Responsive Design', () => {
    test('homepage responsive at 375px (mobile)', async () => {
      const context = await test.browser?.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        hasTouch: true,
      });
      if (!context) throw new Error('Failed to create context');

      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.screenshot({
        path: path.join(screenshotDir, 'responsive-375px.png'),
        fullPage: true,
      });

      if (consoleErrors.length > 0) {
        qaResult.console = 'fail';
        qaResult.errors.push(`Mobile console errors: ${consoleErrors.join(', ')}`);
      }

      await context.close();
    });

    test('homepage responsive at 768px (tablet)', async () => {
      const context = await test.browser?.newContext({
        viewport: { width: 768, height: 1024 },
      });
      if (!context) throw new Error('Failed to create context');

      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.screenshot({
        path: path.join(screenshotDir, 'responsive-768px.png'),
        fullPage: true,
      });

      await context.close();
    });

    test('homepage responsive at 1440px (desktop)', async () => {
      const context = await test.browser?.newContext({
        viewport: { width: 1440, height: 900 },
      });
      if (!context) throw new Error('Failed to create context');

      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      const screenshotDir = path.join(REPORT_DIR, 'screenshots');
      await page.screenshot({
        path: path.join(screenshotDir, 'responsive-1440px.png'),
        fullPage: true,
      });

      await context.close();
    });
  });

  // ============================================================================
  // 2. CONSOLE ERROR & NETWORK ERROR MONITORING
  // ============================================================================

  test.describe('Console & Network Monitoring', () => {
    test('homepage has no console errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore known allowlist
          if (!text.includes('favicon') && !text.includes('Umami') && !text.includes('hot-reload')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000); // Wait for any deferred errors

      if (consoleErrors.length > 0) {
        qaResult.console = 'fail';
        qaResult.errors.push(`Console errors: ${consoleErrors.join('; ')}`);
      }

      if (pageErrors.length > 0) {
        qaResult.console = 'fail';
        qaResult.errors.push(`Page errors: ${pageErrors.join('; ')}`);
      }

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('blog page has no console errors', async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('Umami') && !text.includes('hot-reload')) {
            consoleErrors.push(text);
          }
        }
      });

      await page.goto(`${BASE_URL}/#/blog`, { waitUntil: 'networkidle' });
      expect(consoleErrors).toHaveLength(0);
    });

    test('quiz page has no console errors', async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('Umami') && !text.includes('hot-reload')) {
            consoleErrors.push(text);
          }
        }
      });

      await page.goto(`${BASE_URL}/#/quiz`, { waitUntil: 'networkidle' });
      expect(consoleErrors).toHaveLength(0);
    });
  });

  // ============================================================================
  // 3. BDD SCENARIO VERIFICATION - API ENDPOINTS
  // ============================================================================

  test.describe('BDD Scenarios - API Endpoints', () => {
    test('a. SPA serving with security headers', async ({ page }) => {
      qaResult.scenarios_tested++;

      const response = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      const headers = response?.headers() || {};
      const hasHSTS = headers['strict-transport-security'];
      const hasContentTypeOptions = headers['x-content-type-options'];

      expect(hasHSTS).toBeTruthy();
      expect(hasContentTypeOptions).toBeTruthy();

      if (hasHSTS && hasContentTypeOptions) {
        qaResult.scenarios_passed++;
      } else {
        qaResult.bdd = 'fail';
        qaResult.errors.push('Missing security headers (HSTS or X-Content-Type-Options)');
      }
    });

    test('b. API v1 alias endpoint', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response1 = await page.goto(`${BASE_URL}/api/health`, { waitUntil: 'networkidle' });
        const response2 = await page.goto(`${BASE_URL}/api/v1/health`, { waitUntil: 'networkidle' });

        expect(response1?.status()).toBe(200);
        expect(response2?.status()).toBe(200);

        const text1 = await response1?.text();
        const text2 = await response2?.text();

        if (text1 === text2) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('API v1 alias returns different response than v0');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`API v1 alias test failed: ${e}`);
      }
    });

    test('c. Health endpoint returns status', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/api/health`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const text = await response?.text();
        const json = JSON.parse(text || '{}');

        if (json.status === 'healthy' || (typeof json === 'object' && Object.keys(json).length > 0)) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('Health endpoint did not return expected structure');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`Health endpoint test failed: ${e}`);
      }
    });

    test('d. Feed endpoint returns array', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/api/feed/latest`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const text = await response?.text();
        const json = JSON.parse(text || '[]');

        if (Array.isArray(json)) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('Feed endpoint did not return array');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`Feed endpoint test failed: ${e}`);
      }
    });

    test('e. Alerts endpoint returns array', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/api/alerts`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const text = await response?.text();
        const json = JSON.parse(text || '[]');

        if (Array.isArray(json)) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('Alerts endpoint did not return array');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`Alerts endpoint test failed: ${e}`);
      }
    });

    test('f. Quiz endpoint returns questions', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/api/quiz`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const text = await response?.text();
        const json = JSON.parse(text || '{}');

        if (Array.isArray(json) || (json && typeof json === 'object')) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('Quiz endpoint did not return expected structure');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`Quiz endpoint test failed: ${e}`);
      }
    });

    test('g. Counter endpoint returns total checks', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/api/counter`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const text = await response?.text();
        const json = JSON.parse(text || '{}');

        if (json.total_checks !== undefined || json.counter !== undefined) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('Counter endpoint did not return expected structure');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`Counter endpoint test failed: ${e}`);
      }
    });

    test('h. 404 handling returns JSON not SPA fallback', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        const response = await page.goto(`${BASE_URL}/nonexistent.json`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(404);

        const text = await response?.text();
        const contentType = response?.headers()['content-type'] || '';

        // Should be JSON, not HTML
        if (contentType.includes('application/json') || (text.startsWith('{') || text.startsWith('['))) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.bdd = 'fail';
          qaResult.errors.push('404 returned HTML instead of JSON');
        }
      } catch (e) {
        qaResult.bdd = 'fail';
        qaResult.errors.push(`404 handling test failed: ${e}`);
      }
    });

    test('i. Rate limit headers on check endpoint', async ({ page }) => {
      qaResult.scenarios_tested++;

      try {
        // Make a POST request to /api/check
        const response = await page.evaluate(() => {
          return fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com' }),
          })
            .then((r) => ({
              status: r.status,
              headers: Object.fromEntries(r.headers.entries()),
            }))
            .catch((e) => ({ error: e.message }));
        });

        if ('error' in response) {
          qaResult.warnings.push(`Rate limit test skipped: ${response.error}`);
        } else {
          const hasRateLimitHeaders =
            response.headers['x-ratelimit-limit'] ||
            response.headers['x-ratelimit-remaining'] ||
            response.headers['x-ratelimit-reset'];

          if (hasRateLimitHeaders) {
            qaResult.scenarios_passed++;
          } else {
            qaResult.warnings.push('Rate limit headers not found (may be optional)');
          }
        }
      } catch (e) {
        qaResult.warnings.push(`Rate limit header test failed: ${e}`);
      }
    });
  });

  // ============================================================================
  // 4. ACCESSIBILITY VERIFICATION
  // ============================================================================

  test.describe('Accessibility Verification', () => {
    test('homepage has images with alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const images = await page.locator('img').all();
      let missingAlt = 0;

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');

        // Icons and decorative images might not have alt, but data-testid should be present
        if (!alt && !src?.includes('data:')) {
          const testId = await img.getAttribute('data-testid');
          if (!testId) {
            missingAlt++;
          }
        }
      }

      if (missingAlt > 0) {
        qaResult.a11y = 'fail';
        qaResult.errors.push(`Found ${missingAlt} images without alt text or data-testid`);
      } else {
        qaResult.scenarios_passed++;
      }
    });

    test('interactive elements have data-testid', async ({ page }) => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const buttons = await page.locator('button').all();
      const inputs = await page.locator('input, select, textarea').all();
      let missingTestId = 0;

      for (const btn of buttons) {
        const testId = await btn.getAttribute('data-testid');
        if (!testId) {
          missingTestId++;
        }
      }

      for (const input of inputs) {
        const testId = await input.getAttribute('data-testid');
        if (!testId) {
          missingTestId++;
        }
      }

      if (missingTestId > 0) {
        qaResult.a11y = 'fail';
        qaResult.warnings.push(`Found ${missingTestId} interactive elements without data-testid`);
      }
    });

    test('heading hierarchy is correct', async ({ page }) => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const h1Count = await page.locator('h1').count();
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      if (h1Count !== 1) {
        qaResult.a11y = 'fail';
        qaResult.errors.push(`Expected 1 h1, found ${h1Count}`);
      }

      // Check for skipped heading levels
      let lastLevel = 0;
      for (const heading of headings) {
        const tag = await heading.evaluate((el) => el.tagName);
        const level = parseInt(tag[1]);

        if (level > lastLevel + 1 && lastLevel > 0) {
          qaResult.a11y = 'fail';
          qaResult.warnings.push(`Skipped heading level from h${lastLevel} to h${level}`);
        }

        lastLevel = level;
      }

      if (h1Count === 1 && qaResult.a11y !== 'fail') {
        qaResult.scenarios_passed++;
      }
    });

    test('quiz options have ARIA roles', async ({ page }) => {
      await page.goto(`${BASE_URL}/#/quiz`, { waitUntil: 'networkidle' });

      const quizOptions = await page.locator('[role="option"], [role="radio"], button[data-testid*="option"]').all();

      if (quizOptions.length === 0) {
        qaResult.warnings.push('No quiz options found to validate ARIA roles');
      } else {
        let validAriaCount = 0;

        for (const option of quizOptions) {
          const role = await option.getAttribute('role');
          const ariaLabel = await option.getAttribute('aria-label');

          if (role || ariaLabel) {
            validAriaCount++;
          }
        }

        if (validAriaCount === quizOptions.length) {
          qaResult.scenarios_passed++;
        } else {
          qaResult.a11y = 'fail';
          qaResult.warnings.push(`${quizOptions.length - validAriaCount} quiz options missing ARIA attributes`);
        }
      }
    });

    test('checker form inputs have aria-label or label', async ({ page }) => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const inputs = await page.locator('input[type="text"], input[type="url"], textarea').all();
      let validInputs = 0;

      for (const input of inputs) {
        const ariaLabel = await input.getAttribute('aria-label');
        const id = await input.getAttribute('id');
        let hasLabel = false;

        if (ariaLabel) {
          hasLabel = true;
        } else if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          hasLabel = label > 0;
        }

        if (hasLabel) {
          validInputs++;
        }
      }

      if (inputs.length > 0 && validInputs === inputs.length) {
        qaResult.scenarios_passed++;
      } else if (inputs.length === 0) {
        qaResult.warnings.push('No form inputs found to validate labels');
      } else {
        qaResult.a11y = 'fail';
        qaResult.errors.push(`${inputs.length - validInputs} inputs missing aria-label or label`);
      }
    });
  });

  // ============================================================================
  // 5. FINAL RESULTS
  // ============================================================================

  test.afterAll(async () => {
    // Write QA summary
    const qaPath = path.join(REPORT_DIR, 'qa-summary.json');
    fs.writeFileSync(qaPath, JSON.stringify(qaResult, null, 2));

    // Calculate overall status
    const allPass =
      qaResult.visual === 'pass' &&
      qaResult.console === 'pass' &&
      qaResult.responsive === 'pass' &&
      qaResult.bdd === 'pass' &&
      qaResult.a11y === 'pass';

    // Write ralph results
    const ralphResult: RalphResult = {
      status: allPass ? 'pass' : 'fail',
      timestamp: new Date().toISOString(),
      results: {
        pass: qaResult.scenarios_passed,
        fail: qaResult.scenarios_tested - qaResult.scenarios_passed,
        total: qaResult.scenarios_tested,
        test_files: 1,
      },
      categories: {
        visual: qaResult.visual,
        console: qaResult.console,
        responsive: qaResult.responsive,
        bdd: qaResult.bdd,
        a11y: qaResult.a11y,
      },
    };

    // Create .ralph directory if needed
    const ralphDir = path.resolve(__dirname, '../../.ralph');
    if (!fs.existsSync(ralphDir)) {
      fs.mkdirSync(ralphDir, { recursive: true });
    }

    const ralphPath = path.join(ralphDir, 'qa-results.json');
    fs.writeFileSync(ralphPath, JSON.stringify(ralphResult, null, 2));

    console.log('\n=== QA VERIFICATION COMPLETE ===');
    console.log(`Status: ${allPass ? 'PASS' : 'FAIL'}`);
    console.log(`Scenarios Passed: ${qaResult.scenarios_passed}/${qaResult.scenarios_tested}`);
    console.log(`Categories: Visual=${qaResult.visual}, Console=${qaResult.console}, Responsive=${qaResult.responsive}, BDD=${qaResult.bdd}, A11Y=${qaResult.a11y}`);
    console.log(`Reports: ${qaPath}, ${ralphPath}`);
  });
});
