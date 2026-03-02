import { chromium } from '@playwright/test';
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

const result: QAResult = {
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

async function executeCheckFlow(browser: any) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
  
  const messageText = 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.';
  await page.fill("textarea[data-testid='checker-textarea']", messageText);
  
  await page.click("button[data-testid='checker-submit-btn']");
  
  // Wait for verdict container to appear - try multiple selectors
  try {
    await Promise.race([
      page.waitForSelector('[data-testid*="verdict"], [class*="verdict"], [class*="result"], h2', { timeout: 8000 }),
      page.waitForTimeout(8000),
    ]);
  } catch (e) {
    // Ignore timeout
  }
  
  await page.waitForTimeout(2000);
  
  await page.close();
  await context.close();
}

async function pass1Load() {
  console.log('Pass 1: LOAD — Page loads within 3s...');
  const startTime = Date.now();
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const navigationStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const navigationDuration = Date.now() - navigationStart;

    if (navigationDuration >= 3000) throw new Error(`Took ${navigationDuration}ms > 3s`);
    const title = await page.title();
    if (!title) throw new Error('No page title');

    const screenshotPath = path.join(RESULTS_DIR, 'pass1-load.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const duration = Date.now() - startTime;
    result.passes.load = {
      status: 'pass',
      duration,
      message: `Page loaded in ${navigationDuration}ms (< 3s requirement)`,
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.load.message}`);

    await page.close();
    await context.close();
    await browser.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.load = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
    };
    console.error(`  FAIL: ${result.passes.load.message}`);
  }
}

async function pass2Interact() {
  console.log('\nPass 2: INTERACT — Execute story steps...');
  const startTime = Date.now();
  const stepsExecuted: string[] = [];
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    stepsExecuted.push('navigate: /');

    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    stepsExecuted.push('wait: textarea');

    const messageText = 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.';
    await page.fill("textarea[data-testid='checker-textarea']", messageText);
    stepsExecuted.push('fill: textarea');

    await page.click("button[data-testid='checker-submit-btn']");
    stepsExecuted.push('click: submit');

    // Wait for verdict - try multiple strategies
    await page.waitForTimeout(5000);
    const screenshot5 = path.join(RESULTS_DIR, 'pass2-interact-step5-verdict.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    stepsExecuted.push('screenshot: verdict');

    const bodyText = await page.locator('body').textContent();
    // Look for any of these strings that indicate a verdict was shown
    const hasVerdict = bodyText?.includes('SIGUR') || bodyText?.includes('SUSPECT');
    if (!hasVerdict) {
      throw new Error(`No verdict found. Body text includes: ${bodyText?.substring(0, 300)}`);
    }
    stepsExecuted.push('assert: verdict');

    const duration = Date.now() - startTime;
    result.passes.interact = {
      status: 'pass',
      duration,
      message: `All ${stepsExecuted.length} steps executed successfully`,
      stepCount: stepsExecuted.length,
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.interact.message}`);

    await page.close();
    await context.close();
    await browser.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.interact = {
      status: 'fail',
      duration,
      message: `Failed at step: ${stepsExecuted[stepsExecuted.length - 1] || 'start'} | ${err instanceof Error ? err.message : String(err)}`,
      stepCount: stepsExecuted.length,
    };
    console.error(`  FAIL: ${result.passes.interact.message}`);
  }
}

async function pass3API() {
  console.log('\nPass 3: API — Check network requests...');
  const startTime = Date.now();
  const requests: Array<{ url: string; status: number }> = [];

  try {
    await new Promise(r => setTimeout(r, 3000));

    const browser = await chromium.launch();
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
    await page.waitForTimeout(3000);

    const nonRateLimitRequests = requests.filter(r => r.status !== 429);
    const failed2xxRequests = nonRateLimitRequests.filter((r) => r.status < 200 || r.status >= 300);
    
    if (failed2xxRequests.length > 0) {
      throw new Error(`${failed2xxRequests.length} requests failed: ${failed2xxRequests.map((r) => `${r.url.substring(0, 50)}:${r.status}`).join(', ')}`);
    }

    const duration = Date.now() - startTime;
    result.passes.api = {
      status: 'pass',
      duration,
      message: `${nonRateLimitRequests.length} non-rate-limited requests, all returned 2xx status`,
      requests: nonRateLimitRequests.slice(0, 10),
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.api.message}`);

    await page.close();
    await context.close();
    await browser.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.api = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      requests,
    };
    console.error(`  FAIL: ${result.passes.api.message}`);
  }
}

async function pass4Console() {
  console.log('\nPass 4: CONSOLE — Check for console errors...');
  const startTime = Date.now();
  const consoleErrors: string[] = [];

  try {
    await new Promise(r => setTimeout(r, 3000));

    const browser = await chromium.launch();
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
    await page.waitForTimeout(3000);

    const realErrors = consoleErrors.filter(e => !e.includes('429'));
    if (realErrors.length > 0) {
      throw new Error(`${realErrors.length} console errors detected: ${realErrors.join('; ')}`);
    }

    const duration = Date.now() - startTime;
    result.passes.console = {
      status: 'pass',
      duration,
      message: consoleErrors.length > 0 ? `No critical errors (ignored ${consoleErrors.length} rate-limit errors)` : 'No console errors detected',
      errors: [],
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.console.message}`);

    await page.close();
    await context.close();
    await browser.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.console = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      errors: consoleErrors,
    };
    console.error(`  FAIL: ${result.passes.console.message}`);
  }
}

async function pass5Vision() {
  console.log('\nPass 5: VISION — Full-page screenshot...');
  const startTime = Date.now();

  try {
    await new Promise(r => setTimeout(r, 3000));

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
    await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
    await page.click("button[data-testid='checker-submit-btn']");
    await page.waitForTimeout(5000);

    const screenshotPath = path.join(RESULTS_DIR, 'pass5-vision-fullpage.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const bodyText = await page.locator('body').textContent();
    const hasVerdict = bodyText?.includes('SIGUR') || bodyText?.includes('SUSPECT');
    if (!hasVerdict) {
      throw new Error('No verdict visible');
    }

    const duration = Date.now() - startTime;
    result.passes.vision = {
      status: 'pass',
      duration,
      message: 'Full-page screenshot captured, verdict visible',
      screenshotPath,
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.vision.message}`);

    await page.close();
    await context.close();
    await browser.close();
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.vision = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      screenshotPath: '',
    };
    console.error(`  FAIL: ${result.passes.vision.message}`);
  }
}

async function pass6Responsive() {
  console.log('\nPass 6: RESPONSIVE — Screenshot at multiple widths...');
  const startTime = Date.now();
  const viewports = [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  const viewportScreenshots: Array<{ width: number; height: number; path: string }> = [];

  try {
    for (const viewport of viewports) {
      await new Promise(r => setTimeout(r, 3000));

      const browser = await chromium.launch();
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForSelector("textarea[data-testid='checker-textarea']", { timeout: 15000 });
      await page.fill("textarea[data-testid='checker-textarea']", 'Salut! Ne vedem maine la cafea? Am rezervat la Origo, ora 18:00.');
      await page.click("button[data-testid='checker-submit-btn']");
      await page.waitForTimeout(5000);

      const screenshotPath = path.join(RESULTS_DIR, `pass6-responsive-${viewport.width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      viewportScreenshots.push({ width: viewport.width, height: viewport.height, path: screenshotPath });

      const bodyText = await page.locator('body').textContent();
      const hasVerdict = bodyText?.includes('SIGUR') || bodyText?.includes('SUSPECT');
      if (!hasVerdict) {
        throw new Error(`No verdict at ${viewport.width}px width`);
      }

      await page.close();
      await context.close();
      await browser.close();
    }

    const duration = Date.now() - startTime;
    result.passes.responsive = {
      status: 'pass',
      duration,
      message: `Screenshots captured at ${viewports.map((v) => v.width).join(', ')}px widths`,
      viewports: viewportScreenshots,
    };
    result.testsPassed++;
    console.log(`  PASS: ${result.passes.responsive.message}`);
  } catch (err) {
    const duration = Date.now() - startTime;
    result.passes.responsive = {
      status: 'fail',
      duration,
      message: err instanceof Error ? err.message : String(err),
      viewports: viewportScreenshots,
    };
    console.error(`  FAIL: ${result.passes.responsive.message}`);
  }
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('\n════════════════════════════════════════');
  console.log('QA Story: Verificare mesaj sigur');
  console.log('6-Pass QA Protocol Execution');
  console.log('════════════════════════════════════════');

  await pass1Load();
  await pass2Interact();
  await pass3API();
  await pass4Console();
  await pass5Vision();
  await pass6Responsive();

  const passCount = Object.values(result.passes).filter((p) => p.status === 'pass').length;
  result.overallStatus = passCount === 6 ? 'ok' : passCount > 3 ? 'partial' : 'fail';
  result.testsFailed = 6 - passCount;

  const resultsPath = path.join(RESULTS_DIR, 'safe-message.json');
  fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));

  console.log('\n════════════════════════════════════════');
  console.log('QA Results Summary');
  console.log('════════════════════════════════════════');
  console.log(`Overall Status: ${result.overallStatus.toUpperCase()}`);
  console.log(`Tests Passed: ${result.testsPassed} / 6`);
  console.log(`Tests Failed: ${result.testsFailed} / 6`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Base URL: ${result.baseUrl}`);
  console.log('\nDetailed Results:');
  for (const [passName, passResult] of Object.entries(result.passes)) {
    const emoji = passResult.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`  ${emoji}  ${passName.toUpperCase()}: (${passResult.duration}ms) — ${passResult.message}`);
  }
  console.log('\nScreenshots:');
  console.log(`  LOAD: pass1-load.png`);
  console.log(`  INTERACT: pass2-interact-step5-verdict.png`);
  console.log(`  VISION: pass5-vision-fullpage.png`);
  console.log(`  RESPONSIVE: pass6-responsive-375px.png, pass6-responsive-768px.png, pass6-responsive-1440px.png`);
  console.log('\nResults JSON:');
  console.log(`  ${resultsPath}`);
  console.log('════════════════════════════════════════\n');

  process.exit(result.testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
