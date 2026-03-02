import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { structuredLog } from '../lib/logger';
import type { CommunityReport } from './community';

const VoteRequestSchema = z.object({
  vote: z.enum(['up', 'down']).describe('Directia votului: "up" sau "down"'),
});

const VoteResponseSchema = z.object({
  votes_up: z.number(),
  votes_down: z.number(),
});

export class VoteEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Community'],
    summary: 'Voteaza un raport din comunitate',
    description: 'Adauga un vot pozitiv sau negativ pe un raport de frauda existent.',
    request: {
      params: z.object({
        id: z.string().describe('ID-ul raportului'),
      }),
      body: {
        content: {
          'application/json': {
            schema: VoteRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Voturile actualizate',
        content: {
          'application/json': {
            schema: VoteResponseSchema,
          },
        },
      },
      '400': {
        description: 'Vot invalid',
      },
      '404': {
        description: 'Raportul nu a fost gasit',
      },
      '429': {
        description: 'Limita de voturi depasita',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const voteRl = await checkRateLimit(c.env.CACHE, `vote:${ip}`, ROUTE_RATE_LIMITS['vote'].limit, ROUTE_RATE_LIMITS['vote'].windowSeconds);
    applyRateLimitHeaders((k, v) => c.header(k, v), voteRl);

    if (!voteRl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Ai votat prea mult. Incearca din nou mai tarziu.' } }, 429);
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
      return c.json({ error: { code: 'INVALID_VOTE', message: 'Votul trebuie sa fie "up" sau "down".' } }, 400);
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
  }
}
