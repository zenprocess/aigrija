import { Hono } from 'hono';
import { CAMPAIGNS } from '../data/campaigns';
const sitemap = new Hono();
sitemap.get('/sitemap.xml', (c) => {
    const base = c.env.BASE_URL;
    const urls = [
        `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${base}/alerte</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
        ...CAMPAIGNS.map(ca => `<url><loc>${base}/alerte/${ca.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    c.header('Content-Type', 'application/xml');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.body(xml);
});
sitemap.get('/robots.txt', (c) => {
    const base = c.env.BASE_URL;
    c.header('Content-Type', 'text/plain');
    return c.body(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});
export { sitemap };
