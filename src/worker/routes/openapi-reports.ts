import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { structuredLog } from '../lib/logger';
import type { CommunityReport } from './community';

const CommunityReportSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  text_snippet: z.string(),
  votes_up: z.number(),
  votes_down: z.number(),
  created_at: z.string(),
  verdict: z.string(),
});

export class ReportsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Community'],
    summary: 'Lista rapoartelor comunitatii',
    description: 'Returneaza cele mai recente rapoarte de frauda din comunitate, ordonate dupa voturi. Rezultatele sunt cached 60 secunde.',
    request: {
      query: z.object({
        page: z.coerce.number().int().positive().optional().describe('Numarul paginii (implicit 1)'),
      }),
    },
    responses: {
      '200': {
        description: 'Lista de rapoarte',
        content: {
          'application/json': {
            schema: z.array(CommunityReportSchema),
          },
        },
      },
      '400': {
        description: 'Parametri invalizi',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
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
  }
}
