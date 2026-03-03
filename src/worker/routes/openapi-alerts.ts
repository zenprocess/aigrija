import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { CAMPAIGNS } from '../data/campaigns';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { aggregateSignals } from '../lib/campaign-aggregator';

const VALID_STATUSES = ['active', 'declining', 'resolved'] as const;

const AlertItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(VALID_STATUSES),
  severity: z.string(),
  impersonated_entity: z.string(),
  first_seen: z.string(),
});

const AlertsResponseSchema = z.object({
  campaigns: z.array(AlertItemSchema),
});

export class AlertsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Alerts'],
    summary: 'Lista alertelor de phishing active',
    description: 'Returneaza toate campaniile de phishing cunoscute, cu posibilitate de filtrare dupa status.',
    request: {
      query: z.object({
        status: z.enum(VALID_STATUSES).optional().describe('Filtreaza dupa statusul campaniei'),
      }),
    },
    responses: {
      '200': {
        description: 'Lista campaniilor',
        content: {
          'application/json': {
            schema: AlertsResponseSchema,
          },
        },
      },
      '400': {
        description: 'Status invalid',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const rid = c.get('requestId');
    if (c.env?.CACHE) {
      const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rl = await checkRateLimit(c.env.CACHE, ip, ROUTE_RATE_LIMITS['alerts'].limit, ROUTE_RATE_LIMITS['alerts'].windowSeconds);
      applyRateLimitHeaders((k, v) => c.header(k, v), rl);
      if (!rl.allowed) {
        return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
      }
    }
    const status = c.req.query('status');

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `Status invalid. Valori acceptate: ${VALID_STATUSES.join(', ')}`, request_id: rid } }, 400);
    }

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
  }
}

const EmergingCampaignSchema = z.object({
  id: z.string(),
  scam_type: z.string(),
  domain: z.string().optional(),
  report_count: z.number(),
  confidence: z.number(),
  first_detected: z.number(),
  last_seen: z.number(),
});

const AlertsEmergingResponseSchema = z.object({
  emerging: z.array(EmergingCampaignSchema),
});

const AlertDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(VALID_STATUSES),
  severity: z.string(),
  impersonated_entity: z.string(),
  first_seen: z.string(),
  source: z.literal('curated'),
});

export class AlertsEmergingEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Alerts'],
    summary: 'Campanii emergente detectate de comunitate',
    description: 'Returneaza campaniile de phishing emergente detectate automat prin semnale din comunitate.',
    responses: {
      '200': {
        description: 'Lista campaniilor emergente',
        content: { 'application/json': { schema: AlertsEmergingResponseSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const rid = c.get('requestId');
    if (c.env?.CACHE) {
      const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rl = await checkRateLimit(c.env.CACHE, ip, ROUTE_RATE_LIMITS['alerts'].limit, ROUTE_RATE_LIMITS['alerts'].windowSeconds);
      applyRateLimitHeaders((k, v) => c.header(k, v), rl);
      if (!rl.allowed) {
        return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
      }
    }
    try {
      const result = await aggregateSignals(c.env);
      return c.json(result);
    } catch {
      return c.json({ emerging: [] });
    }
  }
}

export class AlertsBySlugEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Alerts'],
    summary: 'Detalii campanie dupa slug',
    description: 'Returneaza detaliile unei campanii de phishing identificata prin slug.',
    request: {
      params: z.object({
        slug: z.string().describe('Slug-ul campaniei'),
      }),
    },
    responses: {
      '200': {
        description: 'Detaliile campaniei',
        content: { 'application/json': { schema: AlertDetailSchema } },
      },
      '404': {
        description: 'Campania nu a fost gasita',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
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
  }
}
