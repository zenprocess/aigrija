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
