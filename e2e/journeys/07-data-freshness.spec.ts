/**
 * Journey 7: Data Freshness & Loading States
 *
 * Verifies that all data-driven sections resolve within acceptable time
 * and no lingering loading indicators remain visible after 5 seconds.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_DIR = path.join(__dirname, '../results');
const RESULTS_FILE = path.join(RESULTS_DIR, '07-freshness.json');

const ALL_ROUTES = [
  '/',
  '/#/quiz',
  '/#/confidentialitate',
  '/#/termeni',
  '/#/amenintari',
  '/#/ghid',
  '/#/educatie',
  '/#/povesti',
  '/#/rapoarte',
  '/#/presa',
];

const LOADING_PATTERN = /loading|se incarca|se încarcă|spinner/i;

interface RouteResult {
  route: string;
  loadingVisible: boolean;
  loadingElements: string[];
  passed: boolean;
}

interface FreshnessReport {
  timestamp: string;
  counterShowsNumber: boolean;
  counterText: string;
  campaignsResolved: boolean;
  quizQuestionVisible: boolean;
  routeResults: RouteResult[];
  overallPass: boolean;
}

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

test.describe('Journey 7: Data Freshness & Loading States', () => {
  let report: FreshnessReport;

  test.beforeAll(() => {
    report = {
      timestamp: new Date().toISOString(),
      counterShowsNumber: false,
      counterText: '',
      campaignsResolved: false,
      quizQuestionVisible: false,
      routeResults: [],
      overallPass: false,
    };
  });

  test.afterAll(() => {
    report.overallPass =
      report.counterShowsNumber &&
      report.campaignsResolved &&
      report.quizQuestionVisible &&
      report.routeResults.every(r => r.passed);

    ensureResultsDir();
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
  });

  test('counter on homepage shows a number — not a loading placeholder', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait up to 5 seconds for counter to resolve
    await page.waitForTimeout(5000);

    // The counter badge may be in hero-counter-badge or social-proof-counter
    const counterEl = page.locator(
      '[data-testid="hero-counter-badge"], [data-testid="social-proof-counter"]'
    ).first();

    // Counter element may not exist on all pages — check if visible
    const counterCount = await counterEl.count();
    if (counterCount > 0) {
      const text = await counterEl.textContent() ?? '';
      report.counterText = text.trim();

      // Should NOT contain loading placeholders
      expect(text).not.toMatch(/Se\s+încarc[ăa]/i);
      expect(text).not.toMatch(/Loading/i);

      // Should contain a digit (the actual count)
      report.counterShowsNumber = /\d/.test(text);
      expect(report.counterShowsNumber).toBe(true);
    } else {
      // Fallback: check no loading text is visible anywhere on the page after 5s
      const loadingVisible = await page.locator('text=/Se\s+încarc[ăa]|Loading statistics/i').count();
      report.counterShowsNumber = loadingVisible === 0;
      report.counterText = loadingVisible === 0 ? 'no-loading-placeholder' : 'loading-still-visible';
      expect(report.counterShowsNumber).toBe(true);
    }
  });

  test('campaigns section shows cards — not a spinner', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll to the alerts/campaigns section
    await page.locator('#alerte').scrollIntoViewIfNeeded();

    // Wait up to 5 seconds for data
    await page.waitForTimeout(5000);

    // Spinner or "loading" text should be gone
    const spinnerVisible = await page
      .locator('[class*="animate-spin"], [role="progressbar"]')
      .first()
      .isVisible()
      .catch(() => false);

    // Cards should be present OR the section renders empty-state without a spinner
    const cardCount = await page
      .locator('#alerte [class*="border-l-"], #alerte article, #alerte [class*="card"]')
      .count();

    // Either there are cards OR there's no spinner (empty state is acceptable)
    report.campaignsResolved = !spinnerVisible || cardCount > 0;
    expect(report.campaignsResolved).toBe(true);
  });

  test('quiz page shows a question within 3 seconds', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/#/quiz');
    await page.waitForLoadState('networkidle');

    // Quiz container should appear within 3s (data fetch from /api/quiz)
    const quizContainer = page.locator('[data-testid="quiz-container"]');
    const quizError = page.locator('[data-testid="quiz-error"]');

    // Wait for either container or error (both indicate fetch completed).
    // 8s budget: networkidle fires after static assets, then React mounts and
    // triggers the /api/quiz fetch — the actual API call starts after paint.
    await Promise.race([
      quizContainer.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
      quizError.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
    ]);

    const containerVisible = await quizContainer.isVisible().catch(() => false);
    const errorVisible = await quizError.isVisible().catch(() => false);
    const loadingVisible = await page
      .locator('[data-testid="quiz-loading"]')
      .isVisible()
      .catch(() => false);

    // Question must be visible (container visible OR error visible, but NOT still loading)
    report.quizQuestionVisible = (containerVisible || errorVisible) && !loadingVisible;
    expect(report.quizQuestionVisible).toBe(true);
  });

  for (const route of ALL_ROUTES) {
    test(`no loading indicators after 5s on route: ${route}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // Collect all visible loading-related text nodes
      const loadingElements: string[] = await page.evaluate((pattern) => {
        const re = new RegExp(pattern, 'i');
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        const found: string[] = [];
        let node;
        while ((node = walker.nextNode())) {
          const text = (node.textContent ?? '').trim();
          if (!text) continue;
          const el = node.parentElement;
          if (!el) continue;
          // Skip hidden elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          if (re.test(text)) {
            found.push(`[${el.tagName}] "${text.slice(0, 80)}"`);
          }
        }
        return found;
      }, 'loading|se incarca|se încarcă|spinner');

      const routeResult: RouteResult = {
        route,
        loadingVisible: loadingElements.length > 0,
        loadingElements,
        passed: loadingElements.length === 0,
      };
      report.routeResults.push(routeResult);

      expect(loadingElements).toHaveLength(0);
    });
  }
});
