import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { CAMPAIGNS } from '../data/campaigns';

const sitemap = new Hono<{ Bindings: Env }>();

sitemap.get('/sitemap.xml', (c) => {
  const base = c.env.BASE_URL;
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${base}/alerte</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...CAMPAIGNS.map(ca =>
      `<url><loc>${base}/alerte/${ca.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
});

sitemap.get('/robots.txt', (c) => {
  const base = c.env.BASE_URL;
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
});

export { sitemap };
