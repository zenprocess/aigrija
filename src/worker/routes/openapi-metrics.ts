import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { structuredLog } from '../lib/logger';

const WORKER_START_MS = Date.now();

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

const MetricsResponseSchema = z.object({
  uptime_ms: z.number().describe('Uptime in milisecunde de la ultimul cold start'),
  uptime_human: z.string().describe('Uptime in format uman (ex: 2h 15m 30s)'),
  stats: z.object({
    total_checks: z.number(),
  }),
  bindings: z.object({
    kv: z.enum(['ok', 'unavailable']),
    ai: z.enum(['ok', 'unavailable']),
    r2: z.enum(['ok', 'unavailable']),
  }),
  timestamp: z.string(),
  request_id: z.string(),
});

export class MetricsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['System'],
    summary: 'Metrici de sanatate ale platformei',
    description: 'Returneaza metrici detaliate: uptime, statistici, starea binding-urilor (KV, AI, R2).',
    responses: {
      '200': {
        description: 'Metrici de sanatate',
        content: {
          'application/json': {
            schema: MetricsResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const rid = c.get('requestId');
    const uptimeMs = Date.now() - WORKER_START_MS;

    let totalChecks = 0;
    let kvAvailable = false;

    try {
      const raw = await c.env.CACHE.get('stats:total_checks');
      if (raw !== null) {
        totalChecks = parseInt(raw, 10) || 0;
      }
      kvAvailable = true;
    } catch (err) {
      structuredLog('error', 'metrics_kv_read_failed', {
        request_id: rid,
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    return c.json({
      uptime_ms: uptimeMs,
      uptime_human: formatUptime(uptimeMs),
      stats: { total_checks: totalChecks },
      bindings: {
        kv: kvAvailable ? 'ok' : 'unavailable',
        ai: c.env.AI ? 'ok' : 'unavailable',
        r2: c.env.STORAGE ? 'ok' : 'unavailable',
      },
      timestamp: new Date().toISOString(),
      request_id: rid,
    });
  }
}
