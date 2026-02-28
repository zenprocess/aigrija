import { Hono } from 'hono';
import type { Env, EmergingCampaign } from '../lib/types';
import { CAMPAIGNS } from '../data/campaigns';
import { renderAlertPage, renderAlertsIndex } from '../templates/alert-page';
import { aggregateSignals } from '../lib/campaign-aggregator';
import { structuredLog } from '../lib/logger';

const VALID_STATUSES = ['active', 'declining', 'resolved'] as const;

const alerts = new Hono<{ Bindings: Env }>();

alerts.get('/api/alerts', async (c) => {
  const rid = c.get('requestId' as never) as string;
  const status = c.req.query('status');
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Status invalid. Valori acceptate: ${VALID_STATUSES.join(', ')}`, request_id: rid } }, 400);
  }
  const filtered = status ? CAMPAIGNS.filter(ca => ca.status === status) : CAMPAIGNS;

  // Merge community-detected emerging campaigns
  let emergingCampaigns: EmergingCampaign[] = [];
  try {
    const { emerging } = await aggregateSignals(c.env);
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
  try {
    const result = await aggregateSignals(c.env);
    return c.json(result);
  } catch (err) {
    structuredLog('error', '[alerts/emerging] aggregation failed', { error: String(err) });
    return c.json({ emerging: [] });
  }
});


alerts.get('/api/alerts/:slug', async (c) => {
  const rid = c.get('requestId' as never) as string;
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
  if (cached) return c.html(cached);
  const html = renderAlertsIndex(CAMPAIGNS, c.env.BASE_URL);
  await c.env.CACHE.put(cacheKey, html, { expirationTtl: 3600 });
  return c.html(html);
});

alerts.get('/alerte/:slug', async (c) => {
  const rid = c.get('requestId' as never) as string;
  const slug = c.req.param('slug');
  const campaign = CAMPAIGNS.find(ca => ca.slug === slug);
  if (!campaign) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Campania nu a fost gasita.', request_id: rid } }, 404);
  }
  const cacheKey = `page:alerte:${slug}`;
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) return c.html(cached);
  const html = renderAlertPage(campaign, c.env.BASE_URL);
  await c.env.CACHE.put(cacheKey, html, { expirationTtl: 3600 });
  return c.html(html);
});

export { alerts };
