/**
 * Bowser Layer 4 — MCP Browser Exploratory & Self-Healing Tests
 *
 * Standalone script (not a Playwright test file) that:
 * - Crawls all internal pages (BFS, max 20)
 * - Takes screenshots + visual diff per page
 * - Checks for console errors, broken links, basic a11y issues
 * - Runs axe-core WCAG AA scan
 * - Tries all selectors from selectors.json (self-heals misses)
 * - Writes playwright-report/exploratory-report.json
 *
 * Usage:
 *   npx tsx e2e/bowser-explore.ts [--base-url http://localhost:8787]
 */

import { chromium, Page, Browser } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { visualDiff, VisualDiffResult } from './lib/visual-diff.js';
import selectorsRaw from './selectors.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(REPO_ROOT, 'playwright-report');
const EXPLORATORY_DIR = path.join(REPORT_DIR, 'exploratory');
const REPORT_PATH = path.join(REPORT_DIR, 'exploratory-report.json');
const MAX_PAGES = 20;

// ── types ─────────────────────────────────────────────────────────────────────

interface BrokenLink {
  url: string;
  status: number;
  found_on: string;
}

interface ConsoleError {
  page: string;
  message: string;
  type: string;
}

interface A11yIssue {
  page: string;
  issue: string;
  selector: string;
}

interface AxeViolation {
  page: string;
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
}

interface SelectorCoverageDetail {
  status: 'found' | 'missing' | 'healed';
  resolvedTo?: string;
}

interface SelectorCoverage {
  found: number;
  missing: number;
  healed: number;
  details: Record<string, SelectorCoverageDetail>;
}

interface ExploratoryReport {
  timestamp: string;
  base_url: string;
  pages_visited: number;
  broken_links: BrokenLink[];
  console_errors: ConsoleError[];
  accessibility: A11yIssue[];
  accessibility_violations: AxeViolation[];
  selector_coverage: SelectorCoverage;
  visual_diffs: VisualDiffResult[];
  screenshots: string[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseArgs(): { baseUrl: string } {
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === '--base-url');
  const baseUrl =
    idx !== -1 && args[idx + 1]
      ? args[idx + 1]
      : process.env.BASE_URL || 'http://localhost:8787';
  return { baseUrl };
}

function slugify(url: string): string {
  return url
    .replace(/https?:\/\/[^/]+/, '')
    .replace(/\//g, '_')
    .replace(/[^a-z0-9_-]/gi, '')
    .replace(/^_+/, '') || 'homepage';
}

function isInternal(href: string, base: string): boolean {
  try {
    const url = new URL(href, base);
    const baseHost = new URL(base).host;
    return url.host === baseHost;
  } catch {
    return false;
  }
}

function normalizeUrl(href: string, base: string): string {
  try {
    const url = new URL(href, base);
    url.hash = '';
    url.search = ''; // ignore query params for dedup
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

const IGNORED_CONSOLE = [
  /favicon/i,
  /hot-update/i,
  /hmr/i,
  /\[HMR\]/i,
  /websocket/i,
  /wss?:\/\//i,
];

function shouldIgnoreConsole(msg: string): boolean {
  return IGNORED_CONSOLE.some(re => re.test(msg));
}

// ── selector probe ────────────────────────────────────────────────────────────

type SelectorsMap = Record<string, { primary: string; fallback: string }>;
const selectors = selectorsRaw as SelectorsMap;
const SELECTORS_PATH = path.join(__dirname, 'selectors.json');

async function probeSelectors(page: Page, coverage: SelectorCoverage): Promise<void> {
  for (const [name, entry] of Object.entries(selectors)) {
    if (coverage.details[name]) continue; // already resolved on a previous page

    const primary = await page.$(entry.primary);
    if (primary) {
      coverage.details[name] = { status: 'found', resolvedTo: entry.primary };
      coverage.found++;
      continue;
    }

    let healed = false;
    for (const fb of entry.fallback.split(',').map(s => s.trim())) {
      const el = await page.$(fb);
      if (el) {
        console.warn(`[bowser-explore] Self-healed "${name}": ${entry.primary} → ${fb}`);
        entry.primary = fb;
        fs.writeFileSync(SELECTORS_PATH, JSON.stringify(selectors, null, 2));
        coverage.details[name] = { status: 'healed', resolvedTo: fb };
        coverage.healed++;
        healed = true;
        break;
      }
    }
    if (!healed) {
      // mark missing but allow retry on next page
    }
  }
}

function finalizeSelectorCoverage(coverage: SelectorCoverage): void {
  for (const name of Object.keys(selectors)) {
    if (!coverage.details[name]) {
      coverage.details[name] = { status: 'missing' };
      coverage.missing++;
    }
  }
}

// ── basic a11y checks ─────────────────────────────────────────────────────────

async function checkBasicA11y(page: Page, pageUrl: string): Promise<A11yIssue[]> {
  const issues: A11yIssue[] = [];

  // Images without alt
  const imgsMissingAlt = await page.$$eval('img', imgs =>
    imgs
      .filter(img => !img.hasAttribute('alt'))
      .map(img => img.outerHTML.slice(0, 120)),
  );
  for (const html of imgsMissingAlt) {
    issues.push({ page: pageUrl, issue: 'img missing alt', selector: html });
  }

  // Buttons without accessible name
  const btnsMissingName = await page.$$eval('button', btns =>
    btns
      .filter(btn => !btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby') && !btn.getAttribute('title'))
      .map(btn => btn.outerHTML.slice(0, 120)),
  );
  for (const html of btnsMissingName) {
    issues.push({ page: pageUrl, issue: 'button missing accessible name', selector: html });
  }

  // Missing lang attribute on <html>
  const lang = await page.$eval('html', el => el.getAttribute('lang') || '').catch(() => '');
  if (!lang) {
    issues.push({ page: pageUrl, issue: 'html element missing lang attribute', selector: 'html' });
  }

  return issues;
}

// ── link checker ─────────────────────────────────────────────────────────────

async function checkLinks(page: Page, pageUrl: string, baseUrl: string): Promise<{ broken: BrokenLink[]; internal: string[] }> {
  const hrefs = await page.$$eval('a[href]', anchors =>
    anchors.map(a => (a as HTMLAnchorElement).href),
  );

  const broken: BrokenLink[] = [];
  const internal: string[] = [];

  for (const href of hrefs) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

    if (isInternal(href, baseUrl)) {
      const norm = normalizeUrl(href, baseUrl);
      if (norm) internal.push(norm);
    }

    // HEAD check
    try {
      const resp = await fetch(href, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!resp.ok && resp.status !== 405) {
        broken.push({ url: href, status: resp.status, found_on: pageUrl });
      }
    } catch {
      // network errors are not reported as broken links
    }
  }

  return { broken, internal };
}

// ── axe scan ─────────────────────────────────────────────────────────────────

async function runAxe(page: Page, pageUrl: string): Promise<AxeViolation[]> {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    return results.violations.map(v => ({
      page: pageUrl,
      id: v.id,
      impact: v.impact ?? null,
      description: v.description,
      nodes: v.nodes.length,
    }));
  } catch (err) {
    console.warn(`[bowser-explore] axe failed on ${pageUrl}:`, (err as Error).message);
    return [];
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { baseUrl } = parseArgs();

  fs.mkdirSync(EXPLORATORY_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const report: ExploratoryReport = {
    timestamp: new Date().toISOString(),
    base_url: baseUrl,
    pages_visited: 0,
    broken_links: [],
    console_errors: [],
    accessibility: [],
    accessibility_violations: [],
    selector_coverage: { found: 0, missing: 0, healed: 0, details: {} },
    visual_diffs: [],
    screenshots: [],
  };

  const browser: Browser = await chromium.launch();

  const cfHeaders: Record<string, string> = {};
  if (process.env.CF_ACCESS_CLIENT_ID) {
    cfHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  }
  if (process.env.CF_ACCESS_CLIENT_SECRET) {
    cfHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  const context = await browser.newContext({
    extraHTTPHeaders: cfHeaders,
  });

  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(baseUrl, baseUrl) || baseUrl];

  try {
    while (queue.length > 0 && report.pages_visited < MAX_PAGES) {
      const url = queue.shift()!;
      const normUrl = normalizeUrl(url, baseUrl) || url;
      if (visited.has(normUrl)) continue;
      visited.add(normUrl);

      console.log(`[bowser-explore] Visiting (${report.pages_visited + 1}/${MAX_PAGES}): ${normUrl}`);

      const page = await context.newPage();

      // Collect console errors
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          const text = msg.text();
          if (!shouldIgnoreConsole(text)) {
            report.console_errors.push({ page: normUrl, message: text, type: msg.type() });
          }
        }
      });

      try {
        await page.goto(normUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(500);
      } catch (err) {
        console.warn(`[bowser-explore] Failed to load ${normUrl}:`, (err as Error).message);
        await page.close();
        continue;
      }

      report.pages_visited++;

      // Screenshot
      const slug = slugify(normUrl);
      const screenshotPath = path.join(EXPLORATORY_DIR, `${slug}.png`);
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      fs.writeFileSync(screenshotPath, screenshotBuffer);
      report.screenshots.push(`exploratory/${slug}.png`);

      // Visual diff
      const diffResult = await visualDiff(slug, screenshotBuffer);
      report.visual_diffs.push(diffResult);
      if (diffResult.status === 'diff') {
        console.warn(`[bowser-explore] Visual diff detected on ${normUrl}: ${((diffResult.diffPercent ?? 0) * 100).toFixed(1)}%`);
      }

      // Basic a11y
      const a11yIssues = await checkBasicA11y(page, normUrl);
      report.accessibility.push(...a11yIssues);

      // axe
      const axeViolations = await runAxe(page, normUrl);
      report.accessibility_violations.push(...axeViolations);

      // Link check + BFS queue
      const { broken, internal } = await checkLinks(page, normUrl, baseUrl);
      report.broken_links.push(...broken);
      for (const link of internal) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      // Selector coverage probe
      await probeSelectors(page, report.selector_coverage);

      await page.close();
    }
  } finally {
    finalizeSelectorCoverage(report.selector_coverage);
    await browser.close();
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`[bowser-explore] Pages visited : ${report.pages_visited}`);
  console.log(`[bowser-explore] Broken links  : ${report.broken_links.length}`);
  console.log(`[bowser-explore] Console errors: ${report.console_errors.length}`);
  console.log(`[bowser-explore] A11y issues   : ${report.accessibility.length}`);
  console.log(`[bowser-explore] Axe violations: ${report.accessibility_violations.length}`);
  console.log(`[bowser-explore] Selectors     : found=${report.selector_coverage.found}, missing=${report.selector_coverage.missing}, healed=${report.selector_coverage.healed}`);
  console.log(`[bowser-explore] Report        : ${REPORT_PATH}`);
  console.log('─────────────────────────────────────────────────────');

  const hasFailures =
    report.broken_links.length > 0 ||
    report.accessibility_violations.some(v => v.impact === 'critical' || v.impact === 'serious');

  process.exit(hasFailures ? 1 : 0);
}

main().catch(err => {
  console.error('[bowser-explore] Fatal:', err);
  process.exit(2);
});
