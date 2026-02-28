import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit } from '../lib/rate-limiter';

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

  await cache.put(`report:${id}`, JSON.stringify(report), { expirationTtl: 60 * 60 * 24 * 30 });

  const rawIndex = await cache.get('report-index');
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
  index.unshift(id);
  const trimmed = index.slice(0, 500);
  await cache.put('report-index', JSON.stringify(trimmed), { expirationTtl: 60 * 60 * 24 * 30 });
}

community.get('/api/reports', async (c) => {
  const cacheKey = 'community-reports-list';
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Cache-Control', 'public, max-age=60');
    return c.json(JSON.parse(cached));
  }

  const rawIndex = await c.env.CACHE.get('report-index');
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];

  const reports: CommunityReport[] = [];
  for (const id of index.slice(0, 50)) {
    const raw = await c.env.CACHE.get(`report:${id}`);
    if (raw) {
      try {
        reports.push(JSON.parse(raw));
      } catch {
        // skip malformed
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

  const { allowed, remaining } = await checkRateLimit(c.env.CACHE, `vote:${ip}`, 10, 3600);
  c.header('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    c.header('Retry-After', '3600');
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
  } catch {
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
