import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { CAMPAIGNS } from '../data/campaigns';
import { renderAlertPage, renderAlertsIndex } from '../templates/alert-page';

const alerts = new Hono<{ Bindings: Env }>();

alerts.get('/api/alerts', (c) => {
  const status = c.req.query('status');
  const filtered = status ? CAMPAIGNS.filter(ca => ca.status === status) : CAMPAIGNS;
  return c.json({
    campaigns: filtered.map(ca => ({
      id: ca.id,
      slug: ca.slug,
      name: ca.name_ro,
      status: ca.status,
      severity: ca.severity,
      impersonated_entity: ca.impersonated_entity,
      first_seen: ca.first_seen,
    })),
  });
});

alerts.get('/alerte', async (c) => {
  const cacheKey = 'page:alerte:index';
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    return c.html(cached);
  }
  const html = renderAlertsIndex(CAMPAIGNS, c.env.BASE_URL);
  await c.env.CACHE.put(cacheKey, html, { expirationTtl: 3600 });
  return c.html(html);
});

alerts.get('/alerte/:slug', async (c) => {
  const slug = c.req.param('slug');
  const campaign = CAMPAIGNS.find(ca => ca.slug === slug);
  if (!campaign) {
    return c.json({ error: 'Campania nu a fost gasita.' }, 404);
  }
  const cacheKey = `page:alerte:${slug}`;
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    return c.html(cached);
  }
  const html = renderAlertPage(campaign, c.env.BASE_URL);
  await c.env.CACHE.put(cacheKey, html, { expirationTtl: 3600 });
  return c.html(html);
});

export { alerts };
