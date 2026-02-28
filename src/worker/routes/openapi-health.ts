import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';

const ComponentStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string(),
  components: z.object({
    kv: ComponentStatusSchema,
    ai: ComponentStatusSchema,
    r2: ComponentStatusSchema,
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
        description: 'Serviciu degradat sau nefunctional',
        content: {
          'application/json': {
            schema: HealthResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const components: {
      kv: { status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; error?: string };
      ai: { status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; error?: string };
      r2: { status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; error?: string };
    } = {
      kv: { status: 'unhealthy' },
      ai: { status: 'unhealthy' },
      r2: { status: 'unhealthy' },
    };

    // KV check
    try {
      const start = Date.now();
      await c.env.CACHE.get('health-probe');
      components.kv = { status: 'healthy', latency_ms: Date.now() - start };
    } catch (err) {
      components.kv = { status: 'unhealthy', error: err instanceof Error ? err.message : 'KV error' };
    }

    // AI binding check
    components.ai = { status: c.env.AI ? 'healthy' : 'unhealthy' };

    // R2 check — even a 404 means R2 is reachable, so no error = healthy
    try {
      const start = Date.now();
      await c.env.STORAGE.head('health-probe');
      components.r2 = { status: 'healthy', latency_ms: Date.now() - start };
    } catch (err) {
      components.r2 = { status: 'unhealthy', error: err instanceof Error ? err.message : 'R2 error' };
    }

    const statuses = Object.values(components).map(c => c.status);
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (statuses.every(s => s === 'healthy')) {
      overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    const httpStatus = overall === 'healthy' ? 200 : 503;

    return c.json({
      status: overall,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components,
    }, httpStatus);
  }
}
