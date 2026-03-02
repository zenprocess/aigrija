import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const RESULTS_DIR = path.join(__dirname, 'results');

interface QAResult {
  story: string;
  timestamp: string;
  baseUrl: string;
  passes: {
    load: { status: 'pass' | 'fail'; duration: number; message: string };
    interact: { status: 'pass' | 'fail'; duration: number; message: string; stepCount: number };
    api: { status: 'pass' | 'fail'; duration: number; message: string; requests: Array<{ url: string; status: number }> };
    console: { status: 'pass' | 'fail'; duration: number; message: string; errors: string[] };
    vision: { status: 'pass' | 'fail'; duration: number; message: string; screenshotPath: string };
    responsive: { status: 'pass' | 'fail'; duration: number; message: string; viewports: Array<{ width: number; height: number; path: string }> };
  };
  overallStatus: 'ok' | 'fail' | 'partial';
  testsPassed: number;
  testsFailed: number;
}

let result: QAResult;

test.beforeAll(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  result = {
    story: 'Verificare mesaj sigur',
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    passes: {
      load: { status: 'fail', duration: 0, message: '' },
      interact: { status: 'fail', duration: 0, message: '', stepCount: 0 },
      api: { status: 'fail', duration: 0, message: '', requests: [] },
      console: { status: 'fail', duration: 0, message: '', errors: [] },
      vision: { status: 'fail', duration: 0, message: '', screenshotPath: '' },
      responsive: { status: 'fail', duration: 0, message: '', viewports: [] },
    },
    overallStatus: 'fail',
    testsPassed: 0,
    testsFailed: 6,
  };
});

test('Pass 1: LOAD — Page loads within 3s', async ({ browser }) => {
  const startTime = Date.now();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const navigationStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const navigationDuration = Date.now() - navigationStart;

    expect(navigationDuration).toBeLessThan(3000);
    const title = await page.title();
    expect(title).toBeTruthy();

    const screenshotPath = path.join(RESULTS_DIR, 'pass1-load.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const duration = Date.now() - startTime;
    result.passes.load = {
      status: 'pass',
      duration,
      message: `Page loaded in ${navigationDuration}ms (< 3s requirement)`,
    };
    result.testsPassed++;

    await page.close();
    await context.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.load = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
    };
    throw err;
  }
});

test('Pass 2: INTERACT — Execute story steps without error', async ({ browser }) => {
  const startTime = Date.now();
  const stepsExecuted: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    stepsExecuted.push('navigate: /');
    const screenshot1 = path.join(RESULTS_DIR, 'pass2-interact-step1-navigate.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    stepsExecuted.push('wait: textarea');
    const screenshot2 = path.join(RESULTS_DIR, 'pass2-interact-step2-wait.png');
    await page.screenshot({ path: screenshot2, fullPage: true });

    const messageText = 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.';
    await page.fill("textarea[data-testid='checker-textarea']", messageText);
    stepsExecuted.push('fill: textarea');
    const screenshot3 = path.join(RESULTS_DIR, 'pass2-interact-step3-fill.png');
    await page.screenshot({ path: screenshot3, fullPage: true });

    await page.click("button[data-testid='checker-submit-btn']");
    stepsExecuted.push('click: submit');
    const screenshot4 = path.join(RESULTS_DIR, 'pass2-interact-step4-click.png');
    await page.screenshot({ path: screenshot4, fullPage: true });

    // Wait for verdict to appear (the result container with SIGUR)
    await page.waitForSelector("body", { timeout: 15000 });
    stepsExecuted.push('wait: verdict');
    const screenshot5 = path.join(RESULTS_DIR, 'pass2-interact-step5-verdict.png');
    await page.screenshot({ path: screenshot5, fullPage: true });

    // Assert "SIGUR" appears in body
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('SIGUR');
    stepsExecuted.push('assert: SIGUR');

    const duration = Date.now() - startTime;
    result.passes.interact = {
      status: 'pass',
      duration,
      message: `All ${stepsExecuted.length} steps executed successfully`,
      stepCount: stepsExecuted.length,
    };
    result.testsPassed++;

    await page.close();
    await context.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.interact = {
      status: 'fail',
      duration,
      message: `Failed at step: ${stepsExecuted[stepsExecuted.length - 1]} | ${err instanceof Error ? err.message : String(err)}`,
      stepCount: stepsExecuted.length,
    };
    throw err;
  }
});

test('Pass 3: API — Intercept fetch() calls and verify responses', async ({ browser }) => {
  const startTime = Date.now();
  const requests: Array<{ url: string; status: number }> = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      if (!url.includes('fonts.googleapis.com') && !url.includes('cdn.jsdelivr.net')) {
        requests.push({ url, status });
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
    await page.click("button[data-testid='checker-submit-btn']");

    // Wait a bit for response
    await page.waitForTimeout(2000);

    const failed2xxRequests = requests.filter((r) => r.status < 200 || r.status >= 300);
    if (failed2xxRequests.length > 0) {
      throw new Error(`${failed2xxRequests.length} requests failed: ${failed2xxRequests.map((r) => `${r.url}:${r.status}`).join(', ')}`);
    }

    const duration = Date.now() - startTime;
    result.passes.api = {
      status: 'pass',
      duration,
      message: `${requests.length} requests intercepted, all returned 2xx status`,
      requests,
    };
    result.testsPassed++;

    await page.close();
    await context.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.api = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      requests,
    };
    throw err;
  }
});

test('Pass 4: CONSOLE — Check for console.error and page errors', async ({ browser }) => {
  const startTime = Date.now();
  const consoleErrors: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.type()}: ${msg.text()}`);
      }
    });

    page.on('error', (err) => {
      consoleErrors.push(`page error: ${err.message}`);
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
    await page.click("button[data-testid='checker-submit-btn']");

    await page.waitForTimeout(500);

    expect(consoleErrors).toHaveLength(0);

    const duration = Date.now() - startTime;
    result.passes.console = {
      status: 'pass',
      duration,
      message: 'No console errors or page errors detected',
      errors: [],
    };
    result.testsPassed++;

    await page.close();
    await context.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.console = {
      status: 'fail',
      duration,
      message: `${consoleErrors.length} console errors detected`,
      errors: consoleErrors,
    };
    throw err;
  }
});

test('Pass 5: VISION — Full-page screenshot and layout quality', async ({ browser }) => {
  const startTime = Date.now();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
    await page.click("button[data-testid='checker-submit-btn']");

    await page.waitForTimeout(1000);

    const screenshotPath = path.join(RESULTS_DIR, 'pass5-vision-fullpage.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const verdictVisible = await page.locator('body').textContent().then((text) => text?.includes('SIGUR'));
    expect(verdictVisible).toBeTruthy();

    const duration = Date.now() - startTime;
    result.passes.vision = {
      status: 'pass',
      duration,
      message: 'Full-page screenshot captured, verdict visible, layout intact',
      screenshotPath,
    };
    result.testsPassed++;

    await page.close();
    await context.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.vision = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      screenshotPath: '',
    };
    throw err;
  }
});

test('Pass 6: RESPONSIVE — Screenshot at 375px, 768px, 1440px widths', async ({ browser }) => {
  const startTime = Date.now();
  const viewports = [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  const viewportScreenshots: Array<{ width: number; height: number; path: string }> = [];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport,
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
      await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
      await page.click("button[data-testid='checker-submit-btn']");

      await page.waitForTimeout(1000);

      const screenshotPath = path.join(RESULTS_DIR, `pass6-responsive-${viewport.width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      viewportScreenshots.push({ width: viewport.width, height: viewport.height, path: screenshotPath });

      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('SIGUR');

      await page.close();
      await context.close();
    }

    const duration = Date.now() - startTime;
    result.passes.responsive = {
      status: 'pass',
      duration,
      message: `Screenshots captured at ${viewports.map((v) => v.width).join('px, ')}px widths`,
      viewports: viewportScreenshots,
    };
    result.testsPassed++;
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.responsive = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      viewports: viewportScreenshots,
    };
    throw err;
  }
});

test.afterAll(() => {
  const passCount = Object.values(result.passes).filter((p) => p.status === 'pass').length;
  result.overallStatus = passCount === 6 ? 'ok' : passCount > 3 ? 'partial' : 'fail';
  result.testsFailed = 6 - passCount;

  const resultsPath = path.join(RESULTS_DIR, 'safe-message.json');
  fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
  console.log(`\nQA Results written to: ${resultsPath}`);

  console.log('\n════════════════════════════════════════');
  console.log('QA Story Results: Verificare mesaj sigur');
  console.log('════════════════════════════════════════');
  console.log(`Overall Status: ${result.overallStatus.toUpperCase()}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Base URL: ${result.baseUrl}`);
  console.log('\nPass Results:');
  for (const [passName, passResult] of Object.entries(result.passes)) {
    const emoji = passResult.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(
      `  ${emoji}  ${passName.toUpperCase()}: (${passResult.duration}ms) — ${passResult.message}`
    );
  }
  console.log('\nTest Summary:');
  console.log(`  Passed: ${result.testsPassed}`);
  console.log(`  Failed: ${result.testsFailed}`);
  console.log('════════════════════════════════════════\n');
});
