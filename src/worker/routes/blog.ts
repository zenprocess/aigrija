import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { sanityFetch } from '../lib/sanity';
import { structuredLog } from '../lib/logger';

const blog = new Hono<{ Bindings: Env }>();

const PAGE_SIZE = 20;

// ─── KV helpers ──────────────────────────────────────────────────────────────

async function kvGet(env: Env, key: string): Promise<string | null> {
  return env.CACHE.get(key);
}

async function kvPut(env: Env, key: string, value: string, ttl: number): Promise<void> {
  await env.CACHE.put(key, value, { expirationTtl: ttl });
}

async function kvDeleteByPrefix(env: Env, prefix: string): Promise<void> {
  const list = await env.CACHE.list({ prefix });
  await Promise.all(list.keys.map((k) => env.CACHE.delete(k.name)));
}

// ─── Sanity GROQ queries ──────────────────────────────────────────────────────

const BLOG_LIST_QUERY = `*[_type == "blogPost" && language == $lang] | order(publishedAt desc) [$from...$to] { title, slug, excerpt, publishedAt, mainImage, categories[]->{ title, slug }, author->{ name } }`;
const BLOG_POST_QUERY = `*[_type == "blogPost" && slug.current == $slug && language == $lang][0] { ..., body, author->{ name, image, bio }, categories[]->{ title, slug } }`;
const REPORTS_LIST_QUERY = `*[_type == "threatReport" && language == $lang] | order(firstSeen desc) [$from...$to] { title, slug, excerpt, firstSeen, severity, categories[]->{ title, slug } }`;
const REPORT_POST_QUERY = `*[_type == "threatReport" && slug.current == $slug && language == $lang][0] { ..., body, categories[]->{ title, slug } }`;
const GUIDES_LIST_QUERY = `*[_type == "bankGuide" && language == $lang] | order(publishedAt desc) [$from...$to] { title, slug, excerpt, publishedAt, bank, categories[]->{ title, slug } }`;
const GUIDE_POST_QUERY = `*[_type == "bankGuide" && slug.current == $slug && language == $lang][0] { ..., body, categories[]->{ title, slug } }`;
const SITEMAP_QUERY = `{
  "blogPosts": *[_type == "blogPost"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "threatReports": *[_type == "threatReport"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "bankGuides": *[_type == "bankGuide"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt }
}`;
const RSS_QUERY = `*[_type == "blogPost" && language == $lang] | order(publishedAt desc) [0...20] { title, slug, excerpt, publishedAt, author->{ name } }`;

// ─── Blog list ────────────────────────────────────────────────────────────────

blog.get('/blog', async (c) => {
  const lang = c.req.query('lang') || 'ro';
  const page = parseInt(c.req.query('page') || '1', 10);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const cacheKey = `blog:list:${lang}:${page}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const posts = await sanityFetch<unknown[]>(c.env, BLOG_LIST_QUERY, { lang, from, to });
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'blog_list_error', { error: String(err) });
    return c.json({ error: 'Nu am putut incarca articolele.' }, 500);
  }
});

// ─── Blog RSS feed ────────────────────────────────────────────────────────────

blog.get('/blog/feed.xml', async (c) => {
  const lang = c.req.query('lang') || 'ro';
  const cacheKey = `blog:feed:${lang}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('Content-Type', 'application/rss+xml');
    c.header('X-Cache', 'HIT');
    return c.body(cached);
  }

  try {
    type RssPost = { title: string; slug: { current: string }; excerpt?: string; publishedAt?: string; author?: { name: string } };
    const posts = await sanityFetch<RssPost[]>(c.env, RSS_QUERY, { lang });
    const base = c.env.BASE_URL;
    const items = (posts ?? []).map((p) => {
      const link = `${base}/blog/${p.slug?.current ?? ''}`;
      const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : '';
      return [
        '<item>',
        `  <title><![CDATA[${p.title ?? ''}]]></title>`,
        `  <link>${link}</link>`,
        `  <guid>${link}</guid>`,
        pubDate ? `  <pubDate>${pubDate}</pubDate>` : '',
        p.excerpt ? `  <description><![CDATA[${p.excerpt}]]></description>` : '',
        p.author?.name ? `  <author>${p.author.name}</author>` : '',
        '</item>',
      ].filter(Boolean).join('\n');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '<channel>',
      `  <title>ai-grija.ro</title>`,
      `  <link>${base}/blog</link>`,
      `  <description>Articole despre securitate digitala si fraude online</description>`,
      `  <language>${lang}</language>`,
      `  <atom:link href="${base}/blog/feed.xml" rel="self" type="application/rss+xml"/>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');

    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/rss+xml');
    c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'blog_feed_error', { error: String(err) });
    return c.json({ error: 'Nu am putut genera feed-ul RSS.' }, 500);
  }
});

// ─── Blog single post ─────────────────────────────────────────────────────────

blog.get('/blog/:slug', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang') || 'ro';
  const cacheKey = `blog:post:${lang}:${slug}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const post = await sanityFetch<unknown>(c.env, BLOG_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: 'Articolul nu a fost gasit.' }, 404);
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'blog_post_error', { error: String(err), slug });
    return c.json({ error: 'Nu am putut incarca articolul.' }, 500);
  }
});

// ─── Sitemap (extended with Sanity content) ───────────────────────────────────

blog.get('/sitemap-content.xml', async (c) => {
  const cacheKey = 'blog:sitemap';

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('Content-Type', 'application/xml');
    c.header('X-Cache', 'HIT');
    return c.body(cached);
  }

  try {
    const base = c.env.BASE_URL;
    type SitemapDoc = { slug: string; language: string; _updatedAt?: string };
    type SitemapResult = { blogPosts: SitemapDoc[]; threatReports: SitemapDoc[]; bankGuides: SitemapDoc[] };
    const result = await sanityFetch<SitemapResult>(c.env, SITEMAP_QUERY, {});
    const allDocs = result ?? { blogPosts: [], threatReports: [], bankGuides: [] };

    const urlEntries: string[] = [];

    const makeEntry = (path: string, doc: SitemapDoc, changefreq: string, priority: string) => {
      const lastmod = doc._updatedAt ? `<lastmod>${doc._updatedAt.split('T')[0]}</lastmod>` : '';
      return [
        '<url>',
        `  <loc>${base}${path}</loc>`,
        lastmod,
        `  <changefreq>${changefreq}</changefreq>`,
        `  <priority>${priority}</priority>`,
        `  <xhtml:link rel="alternate" hreflang="${doc.language || 'ro'}" href="${base}${path}"/>`,
        '</url>',
      ].filter(Boolean).join('\n');
    };

    for (const doc of allDocs.blogPosts ?? []) {
      urlEntries.push(makeEntry(`/blog/${doc.slug}`, doc, 'weekly', '0.7'));
    }
    for (const doc of allDocs.threatReports ?? []) {
      urlEntries.push(makeEntry(`/reports/${doc.slug}`, doc, 'weekly', '0.8'));
    }
    for (const doc of allDocs.bankGuides ?? []) {
      urlEntries.push(makeEntry(`/guides/${doc.slug}`, doc, 'monthly', '0.7'));
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/xml');
    c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'sitemap_content_error', { error: String(err) });
    return c.json({ error: 'Nu am putut genera sitemap-ul.' }, 500);
  }
});

// ─── Sanity webhook (cache invalidation) ──────────────────────────────────────

blog.post('/blog/webhook', async (c) => {
  if (c.env.SANITY_WEBHOOK_SECRET) {
    const signature = c.req.header('sanity-webhook-signature') || '';
    if (!signature || !signature.includes(c.env.SANITY_WEBHOOK_SECRET)) {
      return c.json({ error: 'Semnatura invalida.' }, 401);
    }
  }

  try {
    await Promise.all([
      kvDeleteByPrefix(c.env, 'blog:list:'),
      kvDeleteByPrefix(c.env, 'blog:post:'),
      kvDeleteByPrefix(c.env, 'blog:feed:'),
      kvDeleteByPrefix(c.env, 'blog:sitemap'),
      kvDeleteByPrefix(c.env, 'reports:list:'),
      kvDeleteByPrefix(c.env, 'reports:post:'),
      kvDeleteByPrefix(c.env, 'guides:list:'),
      kvDeleteByPrefix(c.env, 'guides:post:'),
    ]);
    structuredLog('info', 'blog_cache_invalidated', {});
    return c.json({ ok: true });
  } catch (err) {
    structuredLog('error', 'blog_webhook_error', { error: String(err) });
    return c.json({ error: 'Eroare la invalidarea cache-ului.' }, 500);
  }
});

// ─── Threat Reports ───────────────────────────────────────────────────────────

blog.get('/reports', async (c) => {
  const lang = c.req.query('lang') || 'ro';
  const page = parseInt(c.req.query('page') || '1', 10);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const cacheKey = `reports:list:${lang}:${page}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const posts = await sanityFetch<unknown[]>(c.env, REPORTS_LIST_QUERY, { lang, from, to });
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'reports_list_error', { error: String(err) });
    return c.json({ error: 'Nu am putut incarca rapoartele.' }, 500);
  }
});

blog.get('/reports/:slug', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang') || 'ro';
  const cacheKey = `reports:post:${lang}:${slug}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const post = await sanityFetch<unknown>(c.env, REPORT_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: 'Raportul nu a fost gasit.' }, 404);
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'report_post_error', { error: String(err), slug });
    return c.json({ error: 'Nu am putut incarca raportul.' }, 500);
  }
});

// ─── Bank Guides ──────────────────────────────────────────────────────────────

blog.get('/guides', async (c) => {
  const lang = c.req.query('lang') || 'ro';
  const page = parseInt(c.req.query('page') || '1', 10);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const cacheKey = `guides:list:${lang}:${page}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const posts = await sanityFetch<unknown[]>(c.env, GUIDES_LIST_QUERY, { lang, from, to });
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'guides_list_error', { error: String(err) });
    return c.json({ error: 'Nu am putut incarca ghidurile.' }, 500);
  }
});

blog.get('/guides/:slug', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang') || 'ro';
  const cacheKey = `guides:post:${lang}:${slug}`;

  const cached = await kvGet(c.env, cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Content-Type', 'application/json');
    return c.body(cached);
  }

  try {
    const post = await sanityFetch<unknown>(c.env, GUIDE_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: 'Ghidul nu a fost gasit.' }, 404);
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS');
    c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'guide_post_error', { error: String(err), slug });
    return c.json({ error: 'Nu am putut incarca ghidul.' }, 500);
  }
});

export { blog };
