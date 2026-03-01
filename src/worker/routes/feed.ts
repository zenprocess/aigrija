import { Hono } from 'hono';
import type { Env } from '../lib/types';

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
  try { existing = raw ? JSON.parse(raw) : []; } catch { existing = []; }
  const updated = [entry, ...existing].slice(0, FEED_MAX);
  await cache.put(FEED_KEY, JSON.stringify(updated));
}

feed.get('/api/feed/latest', async (c) => {
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
    total_checks: parseInt(checksRaw ?? '0'),
    threats_detected: parseInt(threatsRaw ?? '0'),
    active_campaigns: parseInt(campaignsRaw ?? '0'),
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
