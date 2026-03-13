import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
import { z } from 'zod';
import type { Env } from '../lib/types';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';

const FeedQuerySchema = z.object({
  format: z.enum(['rss', 'atom', 'json'] as const).optional().default('json'),
  lang: z.enum(['ro', 'en', 'bg', 'hu', 'uk'] as const).optional().default('ro'),
});

const feed = new Hono<{ Bindings: Env }>();

export interface FeedEntry {
  verdict: string;
  scam_type: string;
  timestamp: number;
}

const FEED_KEY = 'feed:latest';
const FEED_MAX = 50;
const FEED_DISPLAY = 5;

export async function prependFeedEntry(cache: KVNamespace, entry: FeedEntry): Promise<void> {
  const raw = await cache.get(FEED_KEY);
  let existing: FeedEntry[] = [];
  try { existing = raw ? JSON.parse(raw) : []; } catch (err) { structuredLog('error', 'feed_parse_error', { error: String(err) }); existing = []; }
  const updated = [entry, ...existing].slice(0, FEED_MAX);
  await cache.put(FEED_KEY, JSON.stringify(updated));
}

feed.get('/api/feed/latest', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['feed'].limit, ROUTE_RATE_LIMITS['feed'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  if (!rl.allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.' } }, 429);
  }
  const _fq = FeedQuerySchema.safeParse({ format: c.req.query('format'), lang: c.req.query('lang') });
  if (!_fq.success) return c.json({ error: { code: 'VALIDATION_ERROR', message: _fq.error.issues.map((i: { message: string }) => i.message).join('; ') } }, 400);
  const raw = await c.env.CACHE.get(FEED_KEY);
  let entries: FeedEntry[] = [];
  try { entries = raw ? JSON.parse(raw) : []; } catch { entries = []; }
  return c.json(entries.slice(0, FEED_DISPLAY));
});


feed.get('/api/stats', async (c) => {
  const [checksRaw, threatsRaw, campaignsRaw] = await Promise.all([
    c.env.CACHE.get('stats:total_checks'),
    c.env.CACHE.get('stats:threats_detected'),
    c.env.CACHE.get('stats:active_campaigns'),
  ]);
  return c.json({
    total_checks: parseInt(checksRaw ?? '0', 10),
    threats_detected: parseInt(threatsRaw ?? '0', 10),
    active_campaigns: parseInt(campaignsRaw ?? '0', 10),
  });
});

feed.get('/api/badges', async (c) => {
  return c.json({
    verified_by: 'Cloudflare Workers AI',
    data_sources: ['Google Safe Browsing', 'VirusTotal', 'URLhaus', 'PhishTank'],
    certifications: ['GDPR Compliant', 'No Data Stored'],
  });
});

export { feed };
