import type { Context, Next } from 'hono';
import { logEvent } from './analytics';
import { checkBudget } from './perf-budget';
import type { Env } from './types';

export interface TimingContext {
  start: number;
  ai: number;
  external: number;
  kv: number;
}

export async function requestContext(c: Context, next: Next) {
  const id = crypto.randomUUID();
  const start = Date.now();
  const timing: TimingContext = { start, ai: 0, external: 0, kv: 0 };

  c.set('requestId' as never, id as never);
  c.set('timing' as never, timing as never);
  c.header('X-Request-Id', id);

  await next();

  const responseTimeMs = Date.now() - start;
  c.header('X-Response-Time', String(responseTimeMs));

  const env = c.env as unknown as Env | undefined;
  if (env) {
    logEvent(env, {
      endpoint: c.req.path,
      responseTimeMs,
      requestId: id,
    });

    const { exceeded, budget } = checkBudget(c.req.path, responseTimeMs);
    if (exceeded) {
      logEvent(env, {
        endpoint: c.req.path,
        responseTimeMs,
        requestId: id,
        extra: { budgetExceeded: true, budget },
      });
    }
  }
}

export function recordTiming(c: Context, category: 'ai' | 'external' | 'kv', ms: number): void {
  const timing = c.get('timing' as never) as TimingContext | undefined;
  if (!timing) return;
  timing[category] += ms;
}
