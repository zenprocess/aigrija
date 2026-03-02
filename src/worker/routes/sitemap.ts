import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { CAMPAIGNS } from '../data/campaigns';
import { structuredLog } from '../lib/logger';

const sitemap = new Hono<{ Bindings: Env }>();

// ─── XML helpers ──────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
}

function buildUrlEntry(entry: UrlEntry): string {
  const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
}

function buildUrlset(entries: UrlEntry[]): string {
  const body = entries.map(buildUrlEntry).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

/** Basic XML well-formedness check */
function isWellFormedXml(xml: string): boolean {
  if (!xml.startsWith('<?xml')) return false;
  const hasUrlset = xml.includes('<urlset') && xml.includes('</urlset>');
  const hasSitemapIndex = xml.includes('<sitemapindex') && xml.includes('</sitemapindex>');
  if (!hasUrlset && !hasSitemapIndex) return false;
  // Check no unescaped ampersands (outside of entity refs)
  const stripped = xml.replace(/&(amp|lt|gt|quot|apos);/g, '');
  if (/&(?!#\d+;)/.test(stripped)) return false;
  return true;
}

// ─── Static public pages ──────────────────────────────────────────────────────

const STATIC_PAGES: UrlEntry[] = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/alerte', changefreq: 'daily', priority: '0.9' },
  { loc: '/saptamanal', changefreq: 'weekly', priority: '0.7' },
  { loc: '/raport', changefreq: 'weekly', priority: '0.6' },
  // Blog section listing pages
  { loc: '/ghid', changefreq: 'weekly', priority: '0.7' },
  { loc: '/educatie', changefreq: 'weekly', priority: '0.7' },
  { loc: '/amenintari', changefreq: 'daily', priority: '0.8' },
  { loc: '/rapoarte', changefreq: 'weekly', priority: '0.7' },
  { loc: '/povesti', changefreq: 'weekly', priority: '0.6' },
  { loc: '/presa', changefreq: 'monthly', priority: '0.6' },
  // Policy / legal pages
  { loc: '/policies/privacy', changefreq: 'monthly', priority: '0.3' },
  { loc: '/policies/general-terms', changefreq: 'monthly', priority: '0.3' },
  { loc: '/gdpr', changefreq: 'monthly', priority: '0.3' },
  // Feeds (discoverable for crawlers)
  { loc: '/feed.xml', changefreq: 'daily', priority: '0.2' },
];

// ─── D1 campaign row type ─────────────────────────────────────────────────────

interface CampaignRow {
  id: string;
  title: string;
  updated_at: string;
}

// ─── GET /sitemap.xml ─────────────────────────────────────────────────────────

sitemap.get('/sitemap.xml', async (c) => {
  const base = c.env.BASE_URL ?? 'https://ai-grija.ro';
  const cacheKey = 'sitemap:main:v2';

  // Try KV cache
  if (c.env.CACHE) {
    try {
      const cached = await c.env.CACHE.get(cacheKey);
      if (cached) {
        c.header('Content-Type', 'application/xml; charset=utf-8');
        c.header('Cache-Control', 'public, max-age=3600');
        c.header('X-Cache', 'HIT');
        return c.body(cached);
      }
    } catch (err) {
      structuredLog('warn', 'sitemap_kv_read_failed', { error: String(err) });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const entries: UrlEntry[] = [];

  // 1) Static pages
  for (const page of STATIC_PAGES) {
    entries.push({ ...page, loc: base + page.loc, lastmod: today });
  }

  // 2) Campaigns from D1 (preferred) or fallback to static CAMPAIGNS array
  let usedD1 = false;
  if (c.env.DB) {
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, title, updated_at FROM campaigns WHERE draft_status = 'published' ORDER BY updated_at DESC LIMIT 500`
      ).all<CampaignRow>();
      const rows = result.results ?? [];
      for (const row of rows) {
        entries.push({
          loc: `${base}/alerte/${escapeXml(row.id)}`,
          lastmod: row.updated_at ? row.updated_at.slice(0, 10) : undefined,
          changefreq: 'weekly',
          priority: '0.8',
        });
      }
      usedD1 = true;
    } catch (err) {
      structuredLog('error', 'sitemap_db_query_failed', { error: String(err) });
    }
  }

  // Fallback: use the static CAMPAIGNS array if D1 not available or failed
  if (!usedD1) {
    for (const ca of CAMPAIGNS) {
      entries.push({
        loc: `${base}/alerte/${ca.slug}`,
        lastmod: ca.first_seen ? ca.first_seen.slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }
  }

  const xml = buildUrlset(entries);

  // Validate before serving
  if (!isWellFormedXml(xml)) {
    structuredLog('error', 'sitemap_malformed_xml', { length: xml.length });
  }

  // Cache in KV
  if (c.env.CACHE) {
    try {
      await c.env.CACHE.put(cacheKey, xml, { expirationTtl: 3600 });
    } catch (err) {
      structuredLog('warn', 'sitemap_kv_write_failed', { error: String(err) });
    }
  }

  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  c.header('X-Cache', 'MISS');
  return c.body(xml);
});

// ─── GET /robots.txt ──────────────────────────────────────────────────────────

sitemap.get('/robots.txt', (c) => {
  const base = c.env.BASE_URL ?? 'https://ai-grija.ro';

  const aiCrawlers = [
    'GPTBot',
    'ChatGPT-User',
    'CCBot',
    'anthropic-ai',
    'Google-Extended',
    'Bytespider',
    'ClaudeBot',
  ];

  const lines = [
    // General crawlers
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /health',
    'Disallow: /_debug/',
    'Disallow: /og/',
    'Disallow: /card/',
    'Disallow: /cdn-cgi/',
    'Crawl-delay: 1',
    '',
    // Block AI training crawlers
    ...aiCrawlers.flatMap((bot) => [
      `User-agent: ${bot}`,
      'Disallow: /',
      '',
    ]),
    `Sitemap: ${base}/sitemap.xml`,
    `Sitemap: ${base}/sitemap-content.xml`,
    '',
  ];

  c.header('Content-Type', 'text/plain');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(lines.join('\n'));
});

export { sitemap, escapeXml, buildUrlEntry, buildUrlset, isWellFormedXml, STATIC_PAGES };
export type { UrlEntry };
