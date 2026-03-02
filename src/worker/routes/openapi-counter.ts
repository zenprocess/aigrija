import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';

const CounterResponseSchema = z.object({
  total_checks: z.number().describe('Numarul total de verificari efectuate'),
});

export class CounterEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Statistics'],
    summary: 'Numarul total de verificari efectuate',
    description: 'Returneaza contorul global de verificari anti-frauda efectuate pe platforma.',
    responses: {
      '200': {
        description: 'Contorul de verificari',
        content: {
          'application/json': {
            schema: CounterResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const key = 'stats:total_checks';
    const raw = await c.env.CACHE.get(key);
    const current = Number(raw) || 0;
    return c.json({ total_checks: current });
  }
}
