import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/types';
import { createSanityClient } from '../lib/sanity';
import { structuredLog } from '../lib/logger';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { renderBlogListPage, renderBlogPostPage } from '../templates/blog-page';

const VALID_BLOG_LANGS = ['ro', 'en', 'bg', 'hu', 'uk'] as const;

const BlogQuerySchema = z.object({
  lang: z.enum(VALID_BLOG_LANGS).optional().default('ro'),
  page: z.coerce.number().int().positive().optional().default(1),
});

type BlogQueryParsed = z.infer<typeof BlogQuerySchema>;

function parseBlogQuery(langRaw?: string, pageRaw?: string): { ok: true; data: BlogQueryParsed } | { ok: false; message: string } {
  const result = BlogQuerySchema.safeParse({ lang: langRaw || undefined, page: pageRaw || undefined });
  if (!result.success) {
    const msg = result.error.issues.map((i: { message: string }) => i.message).join('; ');
    return { ok: false, message: msg };
  }
  return { ok: true, data: result.data };
}

function wantsHtml(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const accept = c.req.header('Accept') || '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

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

const GHID_LIST_QUERY = `*[(_type == "blogPost" && category == "ghid" || _type == "bankGuide") && language == $lang] | order(publishedAt desc) [$from...$to] { _type, title, slug, excerpt, publishedAt, mainImage, categories[]->{ title, slug }, author->{ name } }`;
const GHID_POST_QUERY = `coalesce(*[_type == "blogPost" && category == "ghid" && slug.current == $slug && language == $lang][0], *[_type == "bankGuide" && slug.current == $slug && language == $lang][0]) { ..., body, author->{ name, image, bio }, categories[]->{ title, slug } }`;

const EDUCATIE_LIST_QUERY = `*[(_type == "blogPost" && category == "educatie" || _type == "schoolModule") && language == $lang] | order(publishedAt desc) [$from...$to] { _type, title, slug, excerpt, publishedAt, mainImage, categories[]->{ title, slug }, author->{ name } }`;
const EDUCATIE_POST_QUERY = `coalesce(*[_type == "blogPost" && category == "educatie" && slug.current == $slug && language == $lang][0], *[_type == "schoolModule" && slug.current == $slug && language == $lang][0]) { ..., body, author->{ name, image, bio }, categories[]->{ title, slug } }`;

const AMENINTARI_LIST_QUERY = `*[_type == "threatReport" && language == $lang] | order(firstSeen desc) [$from...$to] { title, slug, excerpt, firstSeen, severity, categories[]->{ title, slug } }`;
const AMENINTARI_POST_QUERY = `*[_type == "threatReport" && slug.current == $slug && language == $lang][0] { ..., body, categories[]->{ title, slug } }`;

const RAPOARTE_LIST_QUERY = `*[_type == "weeklyDigest" && language == $lang] | order(publishedAt desc) [$from...$to] { title, slug, excerpt, publishedAt, categories[]->{ title, slug } }`;
const RAPOARTE_POST_QUERY = `*[_type == "weeklyDigest" && slug.current == $slug && language == $lang][0] { ..., body, categories[]->{ title, slug } }`;

const POVESTI_LIST_QUERY = `*[_type == "communityStory" && language == $lang] | order(publishedAt desc) [$from...$to] { title, slug, excerpt, publishedAt, author->{ name }, categories[]->{ title, slug } }`;
const POVESTI_POST_QUERY = `*[_type == "communityStory" && slug.current == $slug && language == $lang][0] { ..., body, author->{ name, image, bio }, categories[]->{ title, slug } }`;

const PRESA_LIST_QUERY = `*[_type == "pressRelease" && language == $lang] | order(publishedAt desc) [$from...$to] { title, slug, excerpt, publishedAt, categories[]->{ title, slug } }`;
const PRESA_POST_QUERY = `*[_type == "pressRelease" && slug.current == $slug && language == $lang][0] { ..., body, categories[]->{ title, slug } }`;

const SITEMAP_QUERY = `{
  "ghid": *[(_type == "blogPost" && category == "ghid") || _type == "bankGuide"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "educatie": *[(_type == "blogPost" && category == "educatie") || _type == "schoolModule"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "amenintari": *[_type == "threatReport"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "rapoarte": *[_type == "weeklyDigest"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "povesti": *[_type == "communityStory"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt },
  "presa": *[_type == "pressRelease"] { "slug": slug.current, "language": language, "_updatedAt": _updatedAt }
}`;

const RSS_ALL_QUERY = `*[(_type == "blogPost" || _type == "threatReport" || _type == "weeklyDigest" || _type == "communityStory" || _type == "pressRelease") && language == $lang] | order(coalesce(publishedAt, firstSeen) desc) [0...20] { _type, title, slug, excerpt, publishedAt, firstSeen, category, author->{ name } }`;

// ─── RSS builder helper ───────────────────────────────────────────────────────

type RssPost = { _type?: string; title: string; slug: { current: string }; excerpt?: string; publishedAt?: string; firstSeen?: string; category?: string; author?: { name: string } };

function buildRss(posts: RssPost[], base: string, feedPath: string, title: string, description: string, lang: string, pathPrefix: string): string {
  const items = (posts ?? []).map((p) => {
    const date = p.publishedAt || p.firstSeen || '';
    const link = `${base}${pathPrefix}/${p.slug?.current ?? ''}`;
    const pubDate = date ? new Date(date).toUTCString() : '';
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

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `  <title>${title}</title>`,
    `  <link>${base}${pathPrefix}</link>`,
    `  <description>${description}</description>`,
    `  <language>${lang}</language>`,
    `  <atom:link href="${base}${feedPath}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');
}

// ─── /amenintari — Threat Reports ────────────────────────────────────────────

blog.get('/amenintari', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}amenintari:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(AMENINTARI_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'amenintari', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'amenintari_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca rapoartele de amenintari.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/amenintari/feed.xml', async (c) => {
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const cacheKey = `amenintari:feed:${lang}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'HIT'); return c.body(cached); }
  try {
    const query = `*[_type == "threatReport" && language == $lang] | order(firstSeen desc) [0...20] { title, slug, excerpt, firstSeen, author->{ name } }`;
    const sanity = createSanityClient(c.env);
    const posts = await sanity<RssPost[]>(query, { lang });
    const xml = buildRss(posts ?? [], c.env.BASE_URL, '/amenintari/feed.xml', 'ai-grija.ro \u2014 Amenintari', 'Rapoarte de amenintari cibernetice', lang, '/amenintari');
    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'amenintari_feed_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut genera feed-ul RSS.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/amenintari/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}amenintari:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(AMENINTARI_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Raportul nu a fost gasit.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'amenintari', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'amenintari_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca raportul.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /ghid — Guides (blogPost category=ghid + bankGuide) ─────────────────────

blog.get('/ghid', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}ghid:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(GHID_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'ghid', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'ghid_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca ghidurile.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/ghid/feed.xml', async (c) => {
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const cacheKey = `ghid:feed:${lang}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'HIT'); return c.body(cached); }
  try {
    const query = `*[(_type == "blogPost" && category == "ghid" || _type == "bankGuide") && language == $lang] | order(publishedAt desc) [0...20] { title, slug, excerpt, publishedAt, author->{ name } }`;
    const sanity = createSanityClient(c.env);
    const posts = await sanity<RssPost[]>(query, { lang });
    const xml = buildRss(posts ?? [], c.env.BASE_URL, '/ghid/feed.xml', 'ai-grija.ro \u2014 Ghiduri', 'Ghiduri de protectie digitala', lang, '/ghid');
    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'ghid_feed_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut genera feed-ul RSS.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/ghid/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}ghid:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(GHID_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Ghidul nu a fost gasit.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'ghid', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'ghid_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca ghidul.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /educatie — Education posts ─────────────────────────────────────────────

blog.get('/educatie', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}educatie:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(EDUCATIE_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'educatie', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'educatie_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca articolele de educatie.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/educatie/feed.xml', async (c) => {
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const cacheKey = `educatie:feed:${lang}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'HIT'); return c.body(cached); }
  try {
    const query = `*[(_type == "blogPost" && category == "educatie" || _type == "schoolModule") && language == $lang] | order(publishedAt desc) [0...20] { title, slug, excerpt, publishedAt, author->{ name } }`;
    const sanity = createSanityClient(c.env);
    const posts = await sanity<RssPost[]>(query, { lang });
    const xml = buildRss(posts ?? [], c.env.BASE_URL, '/educatie/feed.xml', 'ai-grija.ro \u2014 Educatie digitala', 'Articole de educatie digitala', lang, '/educatie');
    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'educatie_feed_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut genera feed-ul RSS.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/educatie/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}educatie:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(EDUCATIE_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Articolul de educatie nu a fost gasit.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'educatie', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'educatie_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca articolul de educatie.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /rapoarte — Weekly Digest ────────────────────────────────────────────────

blog.get('/rapoarte', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}rapoarte:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(RAPOARTE_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'rapoarte', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'rapoarte_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca rapoartele saptamanale.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/rapoarte/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}rapoarte:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(RAPOARTE_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Raportul saptamanal nu a fost gasit.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'rapoarte', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'rapoarte_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca raportul saptamanal.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /povesti — Community Stories ────────────────────────────────────────────

blog.get('/povesti', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}povesti:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(POVESTI_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'povesti', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'povesti_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca povestile.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/povesti/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}povesti:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(POVESTI_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Povestea nu a fost gasita.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'povesti', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'povesti_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca povestea.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /presa — Press Releases ──────────────────────────────────────────────────

blog.get('/presa', async (c) => {
  const _qp = parseBlogQuery(c.req.query('lang') || undefined, c.req.query('page') || undefined);
  if (!_qp.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _qp.message, request_id: 'unknown' } }, 400);
  const { lang, page } = _qp.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}presa:list:${lang}:${page}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<Record<string, unknown>[]>(PRESA_LIST_QUERY, { lang, from, to });
    if (html) {
      const rendered = renderBlogListPage(posts as never[], 'presa', lang, page, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 300);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(posts ?? []);
    await kvPut(c.env, cacheKey, body, 300);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'presa_list_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca comunicatele de presa.' }, request_id: 'unknown' }, 500);
  }
});

blog.get('/presa/:slug', async (c) => {
  const slug = c.req.param('slug');
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const html = wantsHtml(c);
  const cacheKey = `${html ? 'html:' : ''}presa:post:${lang}:${slug}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('X-Cache', 'HIT'); c.header('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json'); if (html) c.header('Cache-Control', 'public, max-age=300'); return c.body(cached); }
  try {
    const sanity = createSanityClient(c.env);
    const post = await sanity<Record<string, unknown>>(PRESA_POST_QUERY, { slug, lang });
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Comunicatul de presa nu a fost gasit.' }, request_id: 'unknown' }, 404);
    if (html) {
      const rendered = renderBlogPostPage(post as never, 'presa', lang, c.env.BASE_URL);
      await kvPut(c.env, cacheKey, rendered, 600);
      c.header('X-Cache', 'MISS'); c.header('Cache-Control', 'public, max-age=300');
      return c.html(rendered);
    }
    const body = JSON.stringify(post);
    await kvPut(c.env, cacheKey, body, 600);
    c.header('X-Cache', 'MISS'); c.header('Content-Type', 'application/json');
    return c.body(body);
  } catch (err) {
    structuredLog('error', 'presa_post_error', { error: String(err), slug });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut incarca comunicatul de presa.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /feed.xml — Combined RSS feed ───────────────────────────────────────────

blog.get('/feed.xml', async (c) => {
  const _lq = parseBlogQuery(c.req.query('lang') || undefined, undefined);
  if (!_lq.ok) return c.json({ error: { code: 'VALIDATION_ERROR', message: _lq.message, request_id: 'unknown' } }, 400);
  const lang = _lq.data.lang;
  const cacheKey = `feed:all:${lang}`;
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'HIT'); return c.body(cached); }

  try {
    const sanity = createSanityClient(c.env);
    const posts = await sanity<RssPost[]>(RSS_ALL_QUERY, { lang });
    const base = c.env.BASE_URL;

    const items = (posts ?? []).map((p) => {
      const date = p.publishedAt || p.firstSeen || '';
      let prefix = '/ghid';
      if (p._type === 'threatReport') prefix = '/amenintari';
      else if (p._type === 'weeklyDigest') prefix = '/rapoarte';
      else if (p._type === 'communityStory') prefix = '/povesti';
      else if (p._type === 'pressRelease') prefix = '/presa';
      else if (p._type === 'blogPost' && p.category === 'educatie') prefix = '/educatie';
      const link = `${base}${prefix}/${p.slug?.current ?? ''}`;
      const pubDate = date ? new Date(date).toUTCString() : '';
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
      `  <link>${base}</link>`,
      `  <description>Securitate digitala, ghiduri, amenintari si educatie</description>`,
      `  <language>${lang}</language>`,
      `  <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');

    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/rss+xml'); c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'feed_all_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut genera feed-ul RSS.' }, request_id: 'unknown' }, 500);
  }
});

// ─── /sitemap-content.xml ─────────────────────────────────────────────────────

blog.get('/sitemap-content.xml', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['blog'].limit, ROUTE_RATE_LIMITS['blog'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  if (!rl.allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.' }, request_id: 'unknown' }, 429);
  }
  const cacheKey = 'sitemap:content';
  const cached = await kvGet(c.env, cacheKey);
  if (cached) { c.header('Content-Type', 'application/xml'); c.header('X-Cache', 'HIT'); return c.body(cached); }

  try {
    const base = c.env.BASE_URL;
    type SitemapDoc = { slug: string; language: string; _updatedAt?: string };
    type SitemapResult = { ghid: SitemapDoc[]; educatie: SitemapDoc[]; amenintari: SitemapDoc[]; rapoarte: SitemapDoc[]; povesti: SitemapDoc[]; presa: SitemapDoc[] };
    const sanity = createSanityClient(c.env);
    const result = await sanity<SitemapResult>(SITEMAP_QUERY, {});
    const allDocs = result ?? { ghid: [], educatie: [], amenintari: [], rapoarte: [], povesti: [], presa: [] };

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

    for (const doc of allDocs.ghid ?? []) urlEntries.push(makeEntry(`/ghid/${doc.slug}`, doc, 'monthly', '0.7'));
    for (const doc of allDocs.educatie ?? []) urlEntries.push(makeEntry(`/educatie/${doc.slug}`, doc, 'weekly', '0.7'));
    for (const doc of allDocs.amenintari ?? []) urlEntries.push(makeEntry(`/amenintari/${doc.slug}`, doc, 'weekly', '0.8'));
    for (const doc of allDocs.rapoarte ?? []) urlEntries.push(makeEntry(`/rapoarte/${doc.slug}`, doc, 'weekly', '0.7'));
    for (const doc of allDocs.povesti ?? []) urlEntries.push(makeEntry(`/povesti/${doc.slug}`, doc, 'monthly', '0.6'));
    for (const doc of allDocs.presa ?? []) urlEntries.push(makeEntry(`/presa/${doc.slug}`, doc, 'monthly', '0.6'));

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    await kvPut(c.env, cacheKey, xml, 3600);
    c.header('Content-Type', 'application/xml'); c.header('X-Cache', 'MISS');
    return c.body(xml);
  } catch (err) {
    structuredLog('error', 'sitemap_content_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Nu am putut genera sitemap-ul.' }, request_id: 'unknown' }, 500);
  }
});

// ─── POST /content/webhook — Cache invalidation ───────────────────────────────

blog.post('/content/webhook', async (c) => {
  if (c.env.SANITY_WEBHOOK_SECRET) {
    const signature = c.req.header('sanity-webhook-signature') || '';
    if (!signature || !signature.includes(c.env.SANITY_WEBHOOK_SECRET)) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Semnatura invalida.' }, request_id: 'unknown' }, 401);
    }
  }

  try {
    const prefixes = ['amenintari', 'ghid', 'educatie', 'rapoarte', 'povesti', 'presa'];
    const tasks: Promise<void>[] = [];
    for (const prefix of prefixes) {
      tasks.push(kvDeleteByPrefix(c.env, `${prefix}:list:`));
      tasks.push(kvDeleteByPrefix(c.env, `${prefix}:post:`));
      tasks.push(kvDeleteByPrefix(c.env, `${prefix}:feed:`));
      tasks.push(kvDeleteByPrefix(c.env, `html:${prefix}:list:`));
      tasks.push(kvDeleteByPrefix(c.env, `html:${prefix}:post:`));
    }
    tasks.push(kvDeleteByPrefix(c.env, 'feed:all:'));
    tasks.push(kvDeleteByPrefix(c.env, 'sitemap:content'));
    await Promise.all(tasks);
    structuredLog('info', 'content_cache_invalidated', {});
    return c.json({ ok: true });
  } catch (err) {
    structuredLog('error', 'content_webhook_error', { error: String(err) });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Eroare la invalidarea cache-ului.' }, request_id: 'unknown' }, 500);
  }
});

export { blog };
