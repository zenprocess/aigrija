import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';

const StatsResponseSchema = z.object({
  total_checks: z.number().describe('Numarul total de verificari efectuate'),
  threats_detected: z.number().describe('Numarul de amenintari detectate'),
  active_campaigns: z.number().describe('Numarul de campanii de frauda active'),
});

export class StatsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Statistics'],
    summary: 'Statistici ale platformei',
    description: 'Returneaza statisticile agregate ale platformei: verificari, amenintari detectate, campanii active.',
    responses: {
      '200': {
        description: 'Statisticile platformei',
        content: {
          'application/json': {
            schema: StatsResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const [checksRaw, threatsRaw, campaignsRaw] = await Promise.all([
      c.env.CACHE.get('stats:total_checks'),
      c.env.CACHE.get('stats:threats_detected'),
      c.env.CACHE.get('stats:active_campaigns'),
    ]);
    return c.json({
      total_checks: parseInt(checksRaw ?? '0', 10),
      threats_detected: parseInt(threatsRaw ?? '0', 10),
      active_campaigns: parseInt(campaignsRaw ?? '0', 10),
    });
  }
}
