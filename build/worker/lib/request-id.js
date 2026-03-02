import { checkBudget } from './perf-budget';
import { structuredLog } from './logger';
export async function requestId(c, next) {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    c.header('X-Response-Time', `${durationMs}ms`);
    const path = c.req.path;
    const { exceeded, budget } = checkBudget(path, durationMs);
    if (exceeded) {
        structuredLog('warn', 'perf_budget_exceeded', {
            path,
            duration_ms: durationMs,
            budget_ms: budget,
            request_id: id,
        });
        // Also emit as plain console.warn for legacy log scrapers and existing test expectations
        console.warn(`[perf-budget] ${path} took ${durationMs}ms — exceeded budget of ${budget}ms (requestId=${id})`);
    }
}
