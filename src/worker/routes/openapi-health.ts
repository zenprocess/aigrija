import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';

const HealthCheckSchema = z.object({
  status: z.enum(['ok', 'fail', 'skip']),
  latency_ms: z.number().optional(),
});

const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  timestamp: z.string(),
  checks: z.object({
    kv: HealthCheckSchema,
    ai: HealthCheckSchema,
    r2: HealthCheckSchema,
  }),
});

export class HealthEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['System'],
    summary: 'Health check',
    description: 'Verifica starea serviciilor dependente (KV, AI, R2).',
    responses: {
      '200': {
        description: 'Serviciu functional',
        content: {
          'application/json': {
            schema: HealthResponseSchema,
          },
        },
      },
      '503': {
        description: 'Serviciu degradat',
        content: {
          'application/json': {
            schema: HealthResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const checks: { kv: { status: 'ok' | 'fail' | 'skip'; latency_ms?: number }; ai: { status: 'ok' | 'fail' | 'skip'; latency_ms?: number }; r2: { status: 'ok' | 'fail' | 'skip'; latency_ms?: number } } = {
      kv: { status: 'skip' },
      ai: { status: 'skip' },
      r2: { status: 'skip' },
    };

    try {
      const start = Date.now();
      await c.env.CACHE.get('health-probe');
      checks.kv = { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      checks.kv = { status: 'fail' };
    }

    checks.ai = { status: c.env.AI ? 'ok' : 'skip' };

    try {
      const start = Date.now();
      await c.env.STORAGE.head('health-probe');
      checks.r2 = { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      checks.r2 = { status: 'fail' };
    }

    const degraded = checks.kv.status === 'fail' || checks.r2.status === 'fail';

    return c.json({
      status: degraded ? 'degraded' : 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks,
    }, degraded ? 503 : 200);
  }
}
