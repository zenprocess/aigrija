import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
const seo = new Hono();
const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /cdn-cgi/

Sitemap: https://ai-grija.ro/sitemap.xml
`;
const STATIC_URLS = [
    '/',
    '/saptamanal',
    '/alerte',
    '/politica-confidentialitate',
];
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function buildSitemap(base, campaigns) {
    const staticEntries = STATIC_URLS.map((path) => `  <url>\n    <loc>${escapeXml(base + path)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${path === '/' ? '1.0' : '0.8'}</priority>\n  </url>`);
    const dynamicEntries = campaigns.map((row) => {
        const lastmod = row.updated_at ? `\n    <lastmod>${escapeXml(row.updated_at.slice(0, 10))}</lastmod>` : '';
        return `  <url>\n    <loc>${escapeXml(`${base}/alerte/${row.id}`)}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...dynamicEntries].join('\n')}\n</urlset>`;
}
// GET /robots.txt
seo.get('/robots.txt', (c) => {
    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(ROBOTS_TXT);
});
// GET /sitemap.xml — D1-backed with KV cache (TTL 3600)
seo.get('/sitemap.xml', async (c) => {
    const base = c.env.BASE_URL ?? 'https://ai-grija.ro';
    const cacheKey = 'sitemap:xml';
    // Try KV cache first
    if (c.env.CACHE) {
        try {
            const cached = await c.env.CACHE.get(cacheKey);
            if (cached) {
                c.header('Content-Type', 'application/xml; charset=utf-8');
                c.header('Cache-Control', 'public, max-age=3600');
                c.header('X-Cache', 'HIT');
                return c.body(cached);
            }
        }
        catch (err) {
            structuredLog('warn', 'sitemap_kv_read_failed', { error: String(err) });
        }
    }
    // Query D1 for published campaigns
    let campaigns = [];
    if (c.env.DB) {
        try {
            const result = await c.env.DB.prepare(`SELECT id, title, updated_at FROM campaigns WHERE draft_status = 'published' ORDER BY updated_at DESC LIMIT 500`).all();
            campaigns = result.results ?? [];
        }
        catch (err) {
            structuredLog('error', 'sitemap_db_query_failed', { error: String(err) });
            // Continue with empty campaigns list — static URLs still served
        }
    }
    const xml = buildSitemap(base, campaigns);
    // Store in KV with 3600s TTL
    if (c.env.CACHE) {
        try {
            await c.env.CACHE.put(cacheKey, xml, { expirationTtl: 3600 });
        }
        catch (err) {
            structuredLog('warn', 'sitemap_kv_write_failed', { error: String(err) });
        }
    }
    c.header('Content-Type', 'application/xml; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Cache', 'MISS');
    return c.body(xml);
});
export { seo };
