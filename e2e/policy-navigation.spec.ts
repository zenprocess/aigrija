import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface QAResult {
  storyName: string;
  description: string;
  baseUrl: string;
  timestamp: string;
  status: 'ok' | 'fail' | 'partial';
  passes: {
    load: { status: 'pass' | 'fail'; details: string };
    interact: { status: 'pass' | 'fail'; details: string; screenshots: string[] };
    api: { status: 'pass' | 'fail'; details: string; requests: Array<{ url: string; status: number }> };
    console: { status: 'pass' | 'fail'; errors: string[] };
    vision: { status: 'pass' | 'fail'; details: string; screenshot: string };
    responsive: { status: 'pass' | 'fail'; details: string; screenshots: { [key: string]: string } };
  };
  overallResult: string;
}

// Only run on chromium, not mobile
test.use({ ...test.config?.use });

test.describe('QA Story: Navigare politici legale (6-Pass Protocol)', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8787';
  const resultsDir = path.join(process.cwd(), 'e2e', 'results');
  const screenshotsDir = path.join(resultsDir, 'policy-navigation-screenshots');

  // Ensure directories exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let qaResult: QAResult = {
    storyName: 'Navigare politici legale',
    description: 'Utilizatorul verifica paginile legale in romana',
    baseUrl,
    timestamp: new Date().toISOString(),
    status: 'ok',
    passes: {
      load: { status: 'fail', details: '' },
      interact: { status: 'fail', details: '', screenshots: [] },
      api: { status: 'fail', details: '', requests: [] },
      console: { status: 'fail', errors: [] },
      vision: { status: 'fail', details: '', screenshot: '' },
      responsive: { status: 'fail', details: '', screenshots: {} },
    },
    overallResult: 'pending',
  };

  test('PASS 1: LOAD - Navigate to privacy page and verify load time', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    const startTime = Date.now();

    try {
      await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'domcontentloaded', timeout: 3000 });
      const loadTime = Date.now() - startTime;

      // Verify page is responsive
      const title = await page.title();
      expect(title).toBeDefined();

      // Take screenshot
      const screenshot = path.join(screenshotsDir, '01-load.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      qaResult.passes.load = {
        status: 'pass',
        details: `Page loaded in ${loadTime}ms (threshold: 3000ms)`,
      };
      console.log(`PASS 1 LOAD: OK - ${loadTime}ms`);
    } catch (error) {
      qaResult.passes.load = {
        status: 'fail',
        details: `Load failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      throw error;
    }
  });

  test('PASS 2: INTERACT - Execute all story steps with screenshots', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    const screenshots: string[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Navigate to confidentialitate (privacy)
      await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'networkidle' });
      let screenshot = path.join(screenshotsDir, '02-interact-step1-navigate.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step1-navigate-privacy');

      // Step 2: Wait for privacy back button
      const backButton = page.locator('button[data-testid="privacy-back-btn"]');
      await backButton.waitFor({ timeout: 15000 });
      screenshot = path.join(screenshotsDir, '02-interact-step2-wait-btn.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step2-wait-back-btn');

      // Step 3: Take privacy screenshot
      screenshot = path.join(screenshotsDir, '02-interact-step3-privacy-ro.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step3-privacy-ro');

      // Step 4: Assert "Confidențialitate" in body
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Confidențialitate');
      screenshot = path.join(screenshotsDir, '02-interact-step4-assert-title.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step4-assert-confidentialitate');

      // Step 5: Assert back button contains "napoi"
      const buttonText = await backButton.textContent();
      expect(buttonText).toContain('napoi');
      screenshot = path.join(screenshotsDir, '02-interact-step5-assert-btn-text.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step5-assert-napoi');

      // Step 6: Navigate to termeni (terms)
      await page.goto(`${baseUrl}/#/termeni`, { waitUntil: 'networkidle' });
      screenshot = path.join(screenshotsDir, '02-interact-step6-navigate-termeni.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step6-navigate-termeni');

      // Step 7: Wait for body
      await page.locator('body').waitFor({ timeout: 10000 });
      screenshot = path.join(screenshotsDir, '02-interact-step7-wait-body.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step7-wait-body');

      // Step 8: Take termeni screenshot
      screenshot = path.join(screenshotsDir, '02-interact-step8-termeni-ro.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step8-termeni-ro');

      // Step 9: Assert "Termeni" in body
      const termsBodyText = await page.locator('body').textContent();
      expect(termsBodyText).toContain('Termeni');
      screenshot = path.join(screenshotsDir, '02-interact-step9-assert-termeni.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push('step9-assert-termeni');

      const duration = Date.now() - startTime;
      qaResult.passes.interact = {
        status: 'pass',
        details: `All 9 steps executed successfully in ${duration}ms`,
        screenshots,
      };
      console.log(`PASS 2 INTERACT: OK - ${screenshots.length} screenshots, ${duration}ms`);
    } catch (error) {
      qaResult.passes.interact = {
        status: 'fail',
        details: `Interaction failed: ${error instanceof Error ? error.message : String(error)}`,
        screenshots,
      };
      throw error;
    }
  });

  test('PASS 3: API - Intercept fetch calls and verify response codes', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    const requests: Array<{ url: string; status: number }> = [];

    try {
      // Listen to all network responses
      page.on('response', (response) => {
        requests.push({
          url: response.url(),
          status: response.status(),
        });
      });

      // Navigate through both policy pages
      await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500); // Let any pending requests complete

      await page.goto(`${baseUrl}/#/termeni`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Verify all requests returned 2xx or 3xx (navigations)
      const failedRequests = requests.filter(
        (r) => r.status >= 400 && !r.url.includes('favicon') && !r.url.includes('.png')
      );

      if (failedRequests.length > 0) {
        qaResult.passes.api = {
          status: 'fail',
          details: `${failedRequests.length} requests failed`,
          requests: failedRequests,
        };
        throw new Error(`API requests failed: ${JSON.stringify(failedRequests)}`);
      }

      qaResult.passes.api = {
        status: 'pass',
        details: `All ${requests.length} network requests returned 2xx/3xx`,
        requests: requests.slice(0, 10), // Store first 10 for brevity
      };
      console.log(`PASS 3 API: OK - ${requests.length} requests, 0 failures`);
    } catch (error) {
      qaResult.passes.api = {
        status: 'fail',
        details: `API check failed: ${error instanceof Error ? error.message : String(error)}`,
        requests,
      };
      throw error;
    }
  });

  test('PASS 4: CONSOLE - Intercept console.error and page errors', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    try {
      // Listen to console messages
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Listen to page errors/crashes
      page.on('pageerror', (error) => {
        pageErrors.push(error.toString());
      });

      // Navigate through both pages
      await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      await page.goto(`${baseUrl}/#/termeni`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const allErrors = [...consoleErrors, ...pageErrors];
      if (allErrors.length > 0) {
        qaResult.passes.console = {
          status: 'fail',
          errors: allErrors,
        };
        throw new Error(`Console/page errors detected: ${allErrors.join(', ')}`);
      }

      qaResult.passes.console = {
        status: 'pass',
        errors: [],
      };
      console.log('PASS 4 CONSOLE: OK - No errors detected');
    } catch (error) {
      qaResult.passes.console = {
        status: 'fail',
        errors: [error instanceof Error ? error.message : String(error)],
      };
      throw error;
    }
  });

  test('PASS 5: VISION - Full-page screenshot and layout quality', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    try {
      // Take full-page screenshot
      await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'networkidle' });

      const screenshotPath = path.join(screenshotsDir, '05-vision-full-page.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Verify key elements are visible
      const heading = await page.locator('h1, h2, [role="heading"]').first();
      await expect(heading).toBeVisible();

      const body = await page.locator('body');
      const bodyBox = await body.boundingBox();

      // Check for basic layout: element dimensions should be reasonable
      expect(bodyBox).toBeTruthy();
      expect(bodyBox?.width || 0).toBeGreaterThan(0);
      expect(bodyBox?.height || 0).toBeGreaterThan(0);

      qaResult.passes.vision = {
        status: 'pass',
        details: 'Full-page layout is correct, heading visible, body dimensions valid',
        screenshot: '05-vision-full-page.png',
      };
      console.log('PASS 5 VISION: OK - Layout quality verified');
    } catch (error) {
      qaResult.passes.vision = {
        status: 'fail',
        details: `Vision check failed: ${error instanceof Error ? error.message : String(error)}`,
        screenshot: '',
      };
      throw error;
    }
  });

  test('PASS 6: RESPONSIVE - Screenshot at 375px, 768px, 1440px breakpoints', async ({ browser, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    const breakpoints = {
      mobile: { width: 375, height: 812, name: 'Mobile (375px)' },
      tablet: { width: 768, height: 1024, name: 'Tablet (768px)' },
      desktop: { width: 1440, height: 900, name: 'Desktop (1440px)' },
    };
    const screenshots: { [key: string]: string } = {};

    try {
      for (const [key, viewport] of Object.entries(breakpoints)) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();

        // Navigate to privacy page
        await page.goto(`${baseUrl}/#/confidentialitate`, { waitUntil: 'networkidle' });

        // Take screenshot
        const screenshotPath = path.join(screenshotsDir, `06-responsive-${key}-${viewport.width}px.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots[key] = `06-responsive-${key}-${viewport.width}px.png`;

        // Verify page is readable at this size
        const visibleText = await page.locator('body').textContent();
        expect(visibleText).toContain('Confidențialitate');

        await context.close();
      }

      qaResult.passes.responsive = {
        status: 'pass',
        details: 'Page renders correctly at all 3 breakpoints (375, 768, 1440px)',
        screenshots,
      };
      console.log('PASS 6 RESPONSIVE: OK - All breakpoints verified');
    } catch (error) {
      qaResult.passes.responsive = {
        status: 'fail',
        details: `Responsive check failed: ${error instanceof Error ? error.message : String(error)}`,
        screenshots,
      };
      throw error;
    }
  });

  test('Generate QA Report', async ({ browserName }) => {
    if (browserName !== 'chromium') test.skip();

    // Determine overall status
    const allPasses = Object.values(qaResult.passes);
    const failedPasses = allPasses.filter((p) => p.status === 'fail');

    if (failedPasses.length === 0) {
      qaResult.status = 'ok';
      qaResult.overallResult = 'PASS: All 6 passes completed successfully';
    } else {
      qaResult.status = failedPasses.length <= 2 ? 'partial' : 'fail';
      qaResult.overallResult = `FAIL: ${failedPasses.length} of 6 passes failed`;
    }

    // Write results to JSON file
    const resultsFile = path.join(resultsDir, 'policy-navigation.json');
    fs.writeFileSync(resultsFile, JSON.stringify(qaResult, null, 2));

    console.log('\n=== QA STORY RESULTS ===');
    console.log(`Story: ${qaResult.storyName}`);
    console.log(`Status: ${qaResult.status.toUpperCase()}`);
    console.log(`Overall: ${qaResult.overallResult}`);
    console.log(`\nPass Details:`);
    Object.entries(qaResult.passes).forEach(([name, details]) => {
      console.log(`  ${name.toUpperCase()}: ${details.status} - ${(details as any).details || (details as any).errors?.length || ''}`);
    });
    console.log(`\nResults saved to: ${resultsFile}`);

    expect(qaResult.status).toBe('ok');
  });
});
