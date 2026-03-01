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
  const existing: FeedEntry[] = raw ? JSON.parse(raw) : [];
  const updated = [entry, ...existing].slice(0, FEED_MAX);
  await cache.put(FEED_KEY, JSON.stringify(updated));
}

feed.get('/api/feed/latest', async (c) => {
  const raw = await c.env.CACHE.get(FEED_KEY);
  const entries: FeedEntry[] = raw ? JSON.parse(raw) : [];
  return c.json(entries.slice(0, FEED_DISPLAY));
});

export { feed };
