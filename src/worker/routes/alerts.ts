import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, EmergingCampaign } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { CAMPAIGNS } from '../data/campaigns';
import { renderAlertPage, renderAlertsIndex } from '../templates/alert-page';
import { aggregateSignals } from '../lib/campaign-aggregator';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { structuredLog } from '../lib/logger';

const AlertsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  lang: z.enum(['ro', 'en', 'bg', 'hu', 'uk'] as const).optional().default('ro'),
});

const VALID_STATUSES = ['active', 'declining', 'resolved'] as const;

const alerts = new Hono<{ Bindings: Env; Variables: AppVariables }>();

alerts.get('/api/alerts', async (c) => {
  const rid = c.get('requestId');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['alerts'].limit, ROUTE_RATE_LIMITS['alerts'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  if (!rl.allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
  }
  const status = c.req.query('status');
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Status invalid. Valori acceptate: ${VALID_STATUSES.join(', ')}`, request_id: rid } }, 400);
  }
  const filtered = status ? CAMPAIGNS.filter(ca => ca.status === status) : CAMPAIGNS;

  // Merge community-detected emerging campaigns
  let emergingCampaigns: EmergingCampaign[] = [];
  try {
    const { emerging } = await aggregateSignals(c.env.CACHE);
    emergingCampaigns = emerging;
  } catch {
    // Aggregation failure must not break the main alerts response
  }

  return c.json({
    campaigns: filtered.map(ca => ({
      id: ca.id,
      slug: ca.slug,
      name: ca.name_ro,
      status: ca.status,
      severity: ca.severity,
      impersonated_entity: ca.impersonated_entity,
      first_seen: ca.first_seen,
      source: 'curated' as const,
    })),
    emerging_campaigns: emergingCampaigns,
  });
});

alerts.get('/api/alerts/emerging', async (c) => {
  const rid = c.get('requestId');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['alerts'].limit, ROUTE_RATE_LIMITS['alerts'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  if (!rl.allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
  }
  try {
    const result = await aggregateSignals(c.env.CACHE);
    return c.json(result);
  } catch (err) {
    structuredLog('error', '[alerts/emerging] aggregation failed', { error: String(err) });
    return c.json({ emerging: [] });
  }
});


alerts.get('/api/alerts/:slug', async (c) => {
  const rid = c.get('requestId');
  const slug = c.req.param('slug');
  const campaign = CAMPAIGNS.find(ca => ca.slug === slug);
  if (!campaign) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Campania nu a fost gasita.', request_id: rid } }, 404);
  }
  return c.json({
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name_ro,
    status: campaign.status,
    severity: campaign.severity,
    impersonated_entity: campaign.impersonated_entity,
    first_seen: campaign.first_seen,
    source: 'curated' as const,
  });
});

alerts.get('/alerte', async (c) => {
  const cacheKey = 'page:alerte:index';
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    c.header('Cache-Control', 'public, max-age=300');
    return c.html(cached);
  }
  const html = renderAlertsIndex(CAMPAIGNS, c.env.BASE_URL);
  await c.env.CACHE.put(cacheKey, html, { expirationTtl: 3600 });
  return c.html(html);
});

alerts.get('/alerte/:slug', async (c) => {
  const rid = c.get('requestId');
  const slug = c.req.param('slug');
  const campaign = CAMPAIGNS.find(ca => ca.slug === slug);
  if (!campaign) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Campania nu a fost gasita.', request_id: rid } }, 404);
  }
  // Fetch campaign report stats from KV
  let reportCount = 0;
  let lastReport: string | null = null;
  try {
    const countRaw = await c.env.CACHE.get(`campaign-reports:${slug}`);
    if (countRaw) {
      const parsed = JSON.parse(countRaw) as { count?: number; last?: string };
      reportCount = parsed.count ?? 0;
      lastReport = parsed.last ?? null;
    }
  } catch {
    // stats unavailable
  }
  const html = renderAlertPage(campaign, c.env.BASE_URL, undefined, reportCount, lastReport);
  return c.html(html);
});

export { alerts };
