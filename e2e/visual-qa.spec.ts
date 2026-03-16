import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://ai-grija.ro';
const REPORT_DIR = './playwright-report';
const SCREENSHOTS_DIR = path.join(REPORT_DIR, 'screenshots');

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

interface QASummary {
  visual: 'pass' | 'fail';
  console: 'pass' | 'fail';
  responsive: 'pass' | 'fail';
  a11y: 'pass' | 'fail';
  errors: string[];
  warnings: string[];
}

const qaSummary: QASummary = {
  visual: 'pass',
  console: 'pass',
  responsive: 'pass',
  a11y: 'pass',
  errors: [],
  warnings: [],
};

// Helper to capture console errors and warnings
async function captureConsoleMessages(page: Page): Promise<void> {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    // Ignore known safe messages
    if (
      text.includes('favicon') ||
      text.includes('hot reload') ||
      text.includes('websocket') ||
      text.includes('umami') ||
      text.toLowerCase().includes('analytics')
    ) {
      return;
    }

    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${text}`);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(`[${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    const errorMsg = `[pageerror] ${error.message}`;
    // Ignore known safe errors
    if (!errorMsg.includes('favicon') && !errorMsg.includes('analytics')) {
      consoleErrors.push(errorMsg);
    }
  });

  // Wait a bit for any console messages to settle
  await page.waitForLoadState('networkidle');
}

test.describe('ai-grija.ro Visual QA', () => {

  test('Homepage desktop screenshot', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'homepage-desktop-1440.png'),
      fullPage: true,
    });
  });

  test('Blog page screenshot', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/#/blog`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'blog-desktop-1440.png'),
      fullPage: true,
    });
  });

  test('About page screenshot', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/#/despre`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'despre-desktop-1440.png'),
      fullPage: true,
    });
  });

  test('Privacy page screenshot', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/#/confidentialitate`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'privacy-desktop-1440.png'),
      fullPage: true,
    });
  });

  test('Homepage responsive - Mobile 375px', async ({ page }) => {
    page.setViewportSize({ width: 375, height: 812 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'homepage-mobile-375.png'),
      fullPage: true,
    });
  });

  test('Homepage responsive - Tablet 768px', async ({ page }) => {
    page.setViewportSize({ width: 768, height: 1024 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'homepage-tablet-768.png'),
      fullPage: true,
    });
  });

  test('Homepage responsive - Desktop 1440px', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });
    await captureConsoleMessages(page);

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'homepage-desktop-responsive-1440.png'),
      fullPage: true,
    });
  });

  test('Accessibility checks on homepage', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });

    // Capture console errors before navigation
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        pageErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    // Check for images without alt attributes
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const missing: string[] = [];
      images.forEach((img, idx) => {
        if (!img.alt || img.alt.trim() === '') {
          const src = img.src || `[image-${idx}]`;
          missing.push(src);
        }
      });
      return missing;
    });

    if (imagesWithoutAlt.length > 0) {
      qaSummary.warnings.push(`${imagesWithoutAlt.length} images missing alt attributes`);
      qaSummary.a11y = 'fail';
    }

    // Check for data-testid on interactive elements
    const interactiveWithoutTestId = await page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', 'a[onclick]'];
      let count = 0;
      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          if (!el.getAttribute('data-testid') && !el.classList.contains('no-testid')) {
            count++;
          }
        });
      });
      return count;
    });

    if (interactiveWithoutTestId > 0) {
      qaSummary.warnings.push(`${interactiveWithoutTestId} interactive elements missing data-testid`);
    }

    // Check heading hierarchy
    const headingIssues = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const issues: string[] = [];
      let lastLevel = 0;

      if (headings.length === 0) {
        issues.push('No h1 heading found');
      } else {
        const firstHeading = headings[0];
        if (firstHeading.tagName !== 'H1') {
          issues.push('First heading is not h1');
        }
      }

      headings.forEach((h, idx) => {
        const level = parseInt(h.tagName[1]);
        if (idx > 0 && level > lastLevel + 1) {
          issues.push(`Heading level skipped: ${headings[idx - 1].tagName} -> ${h.tagName}`);
        }
        lastLevel = level;
      });

      return issues;
    });

    if (headingIssues.length > 0) {
      qaSummary.warnings.push(...headingIssues);
      qaSummary.a11y = 'fail';
    }

    // Check for console errors
    if (pageErrors.length > 0) {
      qaSummary.errors.push(...pageErrors);
      qaSummary.console = 'fail';
    }
  });

  test('Console error detection on all pages', async ({ page }) => {
    const pages = [
      { name: 'homepage', url: '/' },
      { name: 'blog', url: '/#/blog' },
      { name: 'despre', url: '/#/despre' },
      { name: 'confidentialitate', url: '/#/confidentialitate' },
    ];

    for (const pageInfo of pages) {
      page.setViewportSize({ width: 1440, height: 900 });
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('analytics') && !text.includes('hot reload')) {
            pageErrors.push(`[${pageInfo.name}] ${text}`);
          }
        }
      });

      page.on('pageerror', (error) => {
        const msg = error.message;
        if (!msg.includes('favicon') && !msg.includes('analytics')) {
          pageErrors.push(`[${pageInfo.name}] ${msg}`);
        }
      });

      await page.goto(`${BASE_URL}${pageInfo.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000); // Allow async errors to fire

      if (pageErrors.length > 0) {
        qaSummary.errors.push(...pageErrors);
        qaSummary.console = 'fail';
      }
    }
  });
});

test.afterAll(async () => {
  // Determine overall status
  if (
    qaSummary.visual === 'fail' ||
    qaSummary.console === 'fail' ||
    qaSummary.responsive === 'fail' ||
    qaSummary.a11y === 'fail'
  ) {
    qaSummary.visual = 'fail';
  }

  // Write summary JSON
  fs.writeFileSync(
    path.join(REPORT_DIR, 'qa-summary.json'),
    JSON.stringify(qaSummary, null, 2)
  );

  console.log('QA Summary saved to qa-summary.json');
});
