import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
import { z } from 'zod';
import type { Env } from '../lib/types';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';

const CommunityQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
});

const community = new Hono<{ Bindings: Env }>();

export interface CommunityReport {
  id: string;
  url?: string;
  text_snippet: string;
  votes_up: number;
  votes_down: number;
  created_at: string;
  verdict: string;
  reporter_ip_hash?: string;
}

export async function storeCommunityReport(
  cache: KVNamespace,
  id: string,
  data: {
    url?: string;
    text: string;
    verdict: string;
    reporter_ip_hash?: string;
  }
): Promise<void> {
  const report: CommunityReport = {
    id,
    url: data.url,
    text_snippet: data.text.slice(0, 100),
    votes_up: 1,
    votes_down: 0,
    created_at: new Date().toISOString(),
    verdict: data.verdict,
    reporter_ip_hash: data.reporter_ip_hash,
  };

  const ttl = 60 * 60 * 24 * 30;
  await cache.put(`report:${id}`, JSON.stringify(report), { expirationTtl: ttl });

  // Write a per-report index entry instead of a shared 'report-index' array.
  // Reverse timestamp makes KV list() return newest entries first (lexicographic ASC = chronological DESC).
  // This eliminates the read-modify-write race condition where concurrent writes lose each other's IDs.
  const reverseTs = String(9999999999999 - Date.now()).padStart(13, '0');
  await cache.put(`report-idx:${reverseTs}:${id}`, id, { expirationTtl: ttl });
}

community.get('/api/reports', async (c) => {
  const _cq = CommunityQuerySchema.safeParse({ page: c.req.query('page') });
  if (!_cq.success) return c.json({ error: { code: 'VALIDATION_ERROR', message: _cq.error.issues.map((i: { message: string }) => i.message).join('; ') } }, 400);
  const cacheKey = 'community-reports-list';
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      c.header('X-Cache', 'HIT');
      c.header('Cache-Control', 'public, max-age=60');
      return c.json(parsed);
    } catch (err) {
      structuredLog('error', 'community_cache_parse_error', { error: String(err), key: cacheKey });
      // fall through to fetch fresh data
    }
  }

  const listed = await c.env.CACHE.list({ prefix: 'report-idx:', limit: 500 });
  const index: string[] = listed.keys.map((k: { name: string }) => {
    const afterPrefix = k.name.slice('report-idx:'.length);
    return afterPrefix.slice(afterPrefix.indexOf(':') + 1);
  });

  // Fallback: read legacy 'report-index' key for reports created before the per-key migration.
  if (index.length === 0) {
    const legacyRaw = await c.env.CACHE.get('report-index');
    if (legacyRaw) {
      try {
        const legacyIds = JSON.parse(legacyRaw) as string[];
        index.push(...legacyIds);
      } catch (err) {
        structuredLog('error', 'legacy_report_index_parse_error', { error: String(err) });
      }
    }
  }

  const reports: CommunityReport[] = [];
  for (const id of index.slice(0, 50)) {
    const raw = await c.env.CACHE.get(`report:${id}`);
    if (raw) {
      try {
        reports.push(JSON.parse(raw));
      } catch (err) {
        structuredLog('error', 'community_report_parse_error', { error: String(err), id });
      }
    }
  }

  reports.sort((a, b) => b.votes_up - a.votes_up);
  const result = reports.slice(0, 20);

  await c.env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });

  c.header('X-Cache', 'MISS');
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(result);
});

community.post('/api/reports/:id/vote', async (c) => {
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const voteRl = await createRateLimiter(c.env.CACHE)(`vote:${ip}`, ROUTE_RATE_LIMITS['vote'].limit, ROUTE_RATE_LIMITS['vote'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), voteRl);

  if (!voteRl.allowed) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Ai votat prea mult. Incearca din nou mai tarziu.' } },
      429
    );
  }

  const id = c.req.param('id');
  let body: { vote?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere invalid.' } }, 400);
  }

  const { vote } = body;
  if (vote !== 'up' && vote !== 'down') {
    return c.json(
      { error: { code: 'INVALID_VOTE', message: 'Votul trebuie sa fie "up" sau "down".' } },
      400
    );
  }

  const raw = await c.env.CACHE.get(`report:${id}`);
  if (!raw) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Raportul nu a fost gasit.' } }, 404);
  }

  let report: CommunityReport;
  try {
    report = JSON.parse(raw);
  } catch (err) {
    structuredLog('error', 'community_vote_parse_error', { error: String(err), id });
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Eroare interna.' } }, 500);
  }

  if (vote === 'up') {
    report.votes_up += 1;
  } else {
    report.votes_down += 1;
  }

  await c.env.CACHE.put(`report:${id}`, JSON.stringify(report), { expirationTtl: 60 * 60 * 24 * 30 });
  await c.env.CACHE.delete('community-reports-list');

  return c.json({ votes_up: report.votes_up, votes_down: report.votes_down });
});

export { community };
