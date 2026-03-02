import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { structuredLog } from '../lib/logger';

interface HealthCheck {
  status: 'ok' | 'fail' | 'skip';
  latency_ms?: number;
}

const health = new Hono<{ Bindings: Env }>();

health.get('/health', async (c) => {
  const checks: { kv: HealthCheck; ai: HealthCheck; r2: HealthCheck } = {
    kv: { status: 'skip' },
    ai: { status: 'skip' },
    r2: { status: 'skip' },
  };

  // KV probe
  try {
    const start = Date.now();
    await c.env.CACHE.get('health-probe');
    checks.kv = { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    structuredLog('error', 'health_check_kv_failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    checks.kv = { status: 'fail' };
  }

  // AI binding check (no inference call — too expensive)
  checks.ai = { status: c.env.AI ? 'ok' : 'skip' };

  // R2 probe (404 is fine — means R2 is reachable)
  try {
    const start = Date.now();
    await c.env.STORAGE.head('health-probe');
    checks.r2 = { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    structuredLog('error', 'health_check_r2_failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    checks.r2 = { status: 'fail' };
  }

  const degraded = checks.kv.status === 'fail' || checks.r2.status === 'fail';

  return c.json({
    status: degraded ? 'degraded' : 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks,
  }, degraded ? 503 : 200);
});

export { health };
