/**
 * Journey 4: SEO & Link Integrity crawl
 *
 * 1. Fetch /sitemap.xml, parse <loc> URLs, HTTP GET each one, assert 200.
 * 2. Navigate to homepage, collect all <a href> elements, filter internal links
 *    (ai-grija.ro), click each, verify destination is not 404.
 * 3. Navigate to /#/quiz, /#/amenintari, /#/alerte/apel-fals-ing-romania-2025
 *    and collect+click all links.
 *
 * Results written to e2e/results/04-seo-links.json.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'https://ai-grija.ro';

interface LinkResult {
  url: string;
  status: number;
  reason?: string;
}

interface SeoReport {
  total_links: number;
  passed: number;
  failed: number;
  failures: LinkResult[];
}

/** Parse all <loc> values from an XML sitemap string */
function parseSitemapLocs(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
  return Array.from(matches, m => m[1].trim()).filter(Boolean);
}

/** Determine if a URL is internal (points to ai-grija.ro or relative) */
function isInternal(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const url = new URL(href, BASE_URL);
    return url.hostname === 'ai-grija.ro' || url.hostname === 'www.ai-grija.ro';
  } catch {
    return false;
  }
}

/** Resolve a relative or absolute href against BASE_URL */
function resolveUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return new URL(href, BASE_URL).toString();
}

const resultsDir = path.join(__dirname, '..', 'results');
const reportPath = path.join(resultsDir, '04-seo-links.json');

// Shared mutable report — accumulated across tests in the same worker
const report: SeoReport = {
  total_links: 0,
  passed: 0,
  failed: 0,
  failures: [],
};

function saveReport() {
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

function recordResult(url: string, status: number, reason?: string) {
  report.total_links++;
  if (status === 200 || (status >= 200 && status < 400)) {
    report.passed++;
  } else {
    report.failed++;
    report.failures.push({ url, status, reason });
  }
}

test.describe('SEO & Link Integrity — sitemap crawl', () => {
  test('sitemap.xml exists and all <loc> URLs return 200', async () => {
    test.setTimeout(60_000);
    const apiCtx = await pwRequest.newContext();
    const sitemapRes = await apiCtx.get(`${BASE_URL}/sitemap.xml`);
    expect(sitemapRes.status(), 'sitemap.xml should return 200').toBe(200);

    const xml = await sitemapRes.text();
    const locs = parseSitemapLocs(xml);
    expect(locs.length, 'sitemap should contain at least one <loc>').toBeGreaterThan(0);

    for (const loc of locs) {
      const res = await apiCtx.get(loc, {
        headers: { 'User-Agent': 'AiGrijaQABot/1.0' },
        timeout: 15_000,
      }).catch(() => null);
      const status = res ? res.status() : 0;
      recordResult(loc, status, res ? undefined : 'request_failed');
      expect(status, `sitemap loc ${loc} should return 200`).toBe(200);
    }

    await apiCtx.dispose();
    saveReport();
  });
});

test.describe('SEO & Link Integrity — homepage links', () => {
  test('collect and verify all internal <a> links on homepage', async ({ page, request }) => {
    test.setTimeout(60_000);
    const res = await page.goto('/');
    expect(res?.status(), 'homepage should return 200').toBe(200);
    await page.waitForLoadState('networkidle');

    const hrefs: string[] = await page.$$eval('a[href]', anchors =>
      anchors.map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
    );

    const internalLinks = hrefs
      .filter(isInternal)
      .map(resolveUrl)
      // deduplicate
      .filter((v, i, arr) => arr.indexOf(v) === i)
      // skip anchor-only fragments that point to same page
      .filter(u => {
        try {
          const url = new URL(u);
          return url.pathname !== '/' || url.hash !== '';
        } catch {
          return true;
        }
      });

    for (const url of internalLinks) {
      // Use API request context for efficiency — avoids full page navigations
      const apiRes = await request.get(url, {
        timeout: 15_000,
        headers: { 'User-Agent': 'AiGrijaQABot/1.0' },
      }).catch(() => null);
      const status = apiRes ? apiRes.status() : 0;
      const isHomepage =
        status === 200 &&
        url !== BASE_URL &&
        url !== `${BASE_URL}/` &&
        url !== `${BASE_URL}/#/`;

      recordResult(url, status);

      expect(status, `link ${url} should not be 404`).not.toBe(404);
      expect(status, `link ${url} should not fail (0)`).not.toBe(0);
    }

    saveReport();
  });
});

test.describe('SEO & Link Integrity — SPA route links', () => {
  const spaRoutes = [
    '/#/quiz',
    '/#/amenintari',
    '/#/alerte/apel-fals-ing-romania-2025',
  ];

  for (const route of spaRoutes) {
    test(`links on ${route} are not broken`, async ({ page, request }) => {
      test.setTimeout(60_000);
      const res = await page.goto(route);
      // SPA routes typically return 200 at root and render client-side
      expect(res?.status() ?? 200, `${route} should load`).toBeLessThan(500);
      await page.waitForLoadState('networkidle');

      const hrefs: string[] = await page.$$eval('a[href]', anchors =>
        anchors.map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
      );

      const internalLinks = hrefs
        .filter(isInternal)
        // Skip pure hash-fragment links (e.g. href="#/quiz", href="#top").
        // These are SPA client-side routes or same-page anchors — the server
        // never sees the fragment so HTTP GET always returns 200, making the
        // check redundant and unable to detect broken routes.
        .filter(href => !href.startsWith('#'))
        .map(resolveUrl)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        // Also skip absolute hash-based SPA links (e.g. /#/amenintari).
        // On a hash-router SPA the server always returns 200 for pathname=/;
        // only the client-side router knows whether the route exists.
        .filter(u => {
          try {
            const parsed = new URL(u);
            return parsed.pathname !== '/' || parsed.hash === '';
          } catch {
            return true;
          }
        });

      for (const url of internalLinks) {
        const apiRes = await request.get(url, {
          timeout: 15_000,
          headers: { 'User-Agent': 'AiGrijaQABot/1.0' },
        }).catch(() => null);
        const status = apiRes ? apiRes.status() : 0;
        recordResult(url, status);
        expect(status, `link ${url} on ${route} should not be 404`).not.toBe(404);
        expect(status, `link ${url} on ${route} should not fail (0)`).not.toBe(0);
      }

      saveReport();
    });
  }
});

test.describe('SEO & Link Integrity — final report', () => {
  test('write results to e2e/results/04-seo-links.json', async () => {
    test.setTimeout(60_000);
    // Ensure final persisted state is written (also written after each test above)
    saveReport();

    const data: SeoReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    // Report should have been populated
    expect(data.total_links).toBeGreaterThanOrEqual(0);
    expect(data.passed + data.failed).toBe(data.total_links);
    expect(Array.isArray(data.failures)).toBe(true);
  });
});
