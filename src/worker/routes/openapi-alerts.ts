import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { CAMPAIGNS } from '../data/campaigns';

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

  async handle(c: Context<{ Bindings: Env }>) {
    const rid = c.get('requestId' as never) as string;
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
