import { logEvent } from './analytics';
import { checkBudget } from './perf-budget';
export async function requestContext(c, next) {
    const id = crypto.randomUUID();
    const start = Date.now();
    const timing = { start, ai: 0, external: 0, kv: 0 };
    c.set('requestId', id);
    c.set('timing', timing);
    c.header('X-Request-Id', id);
    await next();
    const responseTimeMs = Date.now() - start;
    c.header('X-Response-Time', String(responseTimeMs));
    const env = c.env;
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
export function recordTiming(c, category, ms) {
    const timing = c.get('timing');
    if (!timing)
        return;
    timing[category] += ms;
}
