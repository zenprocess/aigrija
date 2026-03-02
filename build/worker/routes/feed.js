import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
import { z } from 'zod';
const FeedQuerySchema = z.object({
    format: z.enum(['rss', 'atom', 'json']).optional().default('json'),
    lang: z.enum(['ro', 'en', 'bg', 'hu', 'uk']).optional().default('ro'),
});
const feed = new Hono();
const FEED_KEY = 'feed:latest';
const FEED_MAX = 50;
const FEED_DISPLAY = 5;
export async function prependFeedEntry(cache, entry) {
    const raw = await cache.get(FEED_KEY);
    let existing = [];
    try {
        existing = raw ? JSON.parse(raw) : [];
    }
    catch (err) {
        structuredLog('error', 'feed_parse_error', { error: String(err) });
        existing = [];
    }
    const updated = [entry, ...existing].slice(0, FEED_MAX);
    await cache.put(FEED_KEY, JSON.stringify(updated));
}
feed.get('/api/feed/latest', async (c) => {
    const _fq = FeedQuerySchema.safeParse({ format: c.req.query('format'), lang: c.req.query('lang') });
    if (!_fq.success)
        return c.json({ error: { code: 'VALIDATION_ERROR', message: _fq.error.issues.map((i) => i.message).join('; ') } }, 400);
    const raw = await c.env.CACHE.get(FEED_KEY);
    let entries = [];
    try {
        entries = raw ? JSON.parse(raw) : [];
    }
    catch {
        entries = [];
    }
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
