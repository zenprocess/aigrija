import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
const metrics = new Hono();
// Worker start time approximation — module-level variable, resets on cold start
const WORKER_START_MS = Date.now();
metrics.get('/api/health/metrics', async (c) => {
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
    }
    catch (err) {
        structuredLog('error', 'metrics_kv_read_failed', {
            request_id: rid,
            error: String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
    }
    const body = {
        uptime_ms: uptimeMs,
        uptime_human: formatUptime(uptimeMs),
        stats: {
            total_checks: totalChecks,
        },
        bindings: {
            kv: kvAvailable ? 'ok' : 'unavailable',
            ai: c.env.AI ? 'ok' : 'unavailable',
            r2: c.env.STORAGE ? 'ok' : 'unavailable',
        },
        timestamp: new Date().toISOString(),
        request_id: rid,
    };
    return c.json(body);
});
function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}
export { metrics };
