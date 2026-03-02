/**
 * Pre-defined per-route limits.
 * Callers may use these or supply their own values directly.
 */
export const ROUTE_RATE_LIMITS = {
    // High-value AI endpoint — strictest limit
    'check': { limit: 20, windowSeconds: 3600 },
    // Image analysis — same as text check (AI-heavy)
    'check-image': { limit: 20, windowSeconds: 3600 },
    // QR check is lighter but still AI-adjacent
    'check-qr': { limit: 30, windowSeconds: 3600 },
    // Report generation — read-only, generous
    'report': { limit: 100, windowSeconds: 3600 },
    // Community voting — tighter to prevent abuse
    'vote': { limit: 10, windowSeconds: 3600 },
    // Bot webhooks — per-user, moderate
    'telegram': { limit: 50, windowSeconds: 3600 },
    'whatsapp': { limit: 50, windowSeconds: 3600 },
    // Counter endpoint — very generous
    'counter': { limit: 200, windowSeconds: 3600 },
    // Alerts / blog / card / og — read-heavy, generous
    'alerts': { limit: 60, windowSeconds: 60 },
    'blog': { limit: 60, windowSeconds: 60 },
    'card': { limit: 60, windowSeconds: 60 },
    'og': { limit: 60, windowSeconds: 60 },
    // RSS feeds — crawlers hammer these; stricter
    'feed': { limit: 30, windowSeconds: 60 },
};
/**
 * Check and increment the rate limit counter for a given identifier.
 *
 * @param cache          KV namespace used to store counters.
 * @param identifier     Unique key for this client (e.g. IP, user ID).
 * @param limit          Maximum requests allowed within the window.
 * @param windowSeconds  Length of the rate-limit window in seconds.
 * @returns              RateLimitResult with allowed flag, remaining count, limit, and reset timestamp.
 */
export async function checkRateLimit(cache, identifier, limit = ROUTE_RATE_LIMITS['check'].limit, windowSeconds = ROUTE_RATE_LIMITS['check'].windowSeconds) {
    const key = `rl:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    // Approximate reset: current time + full window.
    // Because KV put always resets TTL (sliding window), this is an approximation.
    const reset = now + windowSeconds;
    const raw = await cache.get(key);
    if (raw === null) {
        await cache.put(key, '1', { expirationTtl: windowSeconds });
        return { allowed: true, remaining: limit - 1, limit, reset };
    }
    const current = parseInt(raw, 10);
    if (current >= limit) {
        return { allowed: false, remaining: 0, limit, reset };
    }
    // Increment counter — note: KV put always resets TTL, creating a sliding window.
    // We accept this tradeoff. For strict fixed windows, use Durable Objects instead.
    await cache.put(key, String(current + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - current - 1, limit, reset };
}
/**
 * Apply standard rate-limit response headers to a Hono context.
 *
 * Sets: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 * Also sets Retry-After when the request is not allowed.
 *
 * @param setHeader  Function to set a response header (e.g. c.header from Hono).
 * @param result     The RateLimitResult from checkRateLimit.
 */
export function applyRateLimitHeaders(setHeader, result) {
    setHeader('X-RateLimit-Limit', String(result.limit));
    setHeader('X-RateLimit-Remaining', String(result.remaining));
    setHeader('X-RateLimit-Reset', String(result.reset));
    if (!result.allowed) {
        // Retry-After is the number of seconds until the window resets
        const now = Math.floor(Date.now() / 1000);
        setHeader('Retry-After', String(Math.max(1, result.reset - now)));
    }
}
