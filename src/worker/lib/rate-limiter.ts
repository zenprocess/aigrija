/**
 * Per-route rate limit configurations.
 * Each entry maps a route key to { limit, windowSeconds }.
 *
 * Route keys are arbitrary strings callers use to look up config.
 */
export interface RouteRateLimitConfig {
  limit: number;
  windowSeconds: number;
}

/**
 * Pre-defined per-route limits.
 * Callers may use these or supply their own values directly.
 */
export const ROUTE_RATE_LIMITS: Record<string, RouteRateLimitConfig> = {
  // High-value AI endpoint — strictest limit
  'check':          { limit: 20,  windowSeconds: 3600 },
  // Image analysis — same as text check (AI-heavy)
  'check-image':    { limit: 20,  windowSeconds: 3600 },
  // QR check is lighter but still AI-adjacent
  'check-qr':       { limit: 30,  windowSeconds: 3600 },
  // Report generation — read-only, generous
  'report':         { limit: 100, windowSeconds: 3600 },
  // Community voting — tighter to prevent abuse
  'vote':           { limit: 10,  windowSeconds: 3600 },
  // Bot webhooks — per-user, moderate
  'telegram':       { limit: 50,  windowSeconds: 3600 },
  'whatsapp':       { limit: 50,  windowSeconds: 3600 },
  // Counter endpoint — very generous
  'counter':        { limit: 200, windowSeconds: 3600 },
  // Alerts / blog / card / og — read-heavy, generous
  'alerts':         { limit: 60,  windowSeconds: 120 },
  'blog':           { limit: 60,  windowSeconds: 120 },
  'card':           { limit: 60,  windowSeconds: 120 },
  'og':             { limit: 60,  windowSeconds: 120 },
  // RSS feeds — crawlers hammer these; stricter
  'feed':           { limit: 30,  windowSeconds: 120 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Unix timestamp (seconds) when the window resets. */
  reset: number;
}

/**
 * Check and increment the rate limit counter for a given identifier.
 *
 * Uses a fixed-window strategy: the KV key encodes the window slot so each
 * window gets a fresh key with a TTL equal to windowSeconds. The key expires
 * automatically at the end of the window — no sliding-window accumulation.
 *
 * Key format: `rl:{identifier}:{windowSlot}` where windowSlot is
 * `Math.floor(now / windowSeconds)`. This means every windowSeconds seconds a
 * new slot begins and the previous key is garbage-collected by KV TTL.
 *
 * @param cache          KV namespace used to store counters.
 * @param identifier     Unique key for this client (e.g. IP, user ID).
 * @param limit          Maximum requests allowed within the window.
 * @param windowSeconds  Length of the rate-limit window in seconds.
 * @returns              RateLimitResult with allowed flag, remaining count, limit, and reset timestamp.
 */
export async function checkRateLimit(
  cache: KVNamespace,
  identifier: string,
  limit: number = ROUTE_RATE_LIMITS['check'].limit,
  windowSeconds: number = ROUTE_RATE_LIMITS['check'].windowSeconds,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  // Fixed-window slot: increments every windowSeconds seconds.
  const windowSlot = Math.floor(now / windowSeconds);
  // The window resets at the start of the next slot.
  const reset = (windowSlot + 1) * windowSeconds;
  // TTL is the remaining time until the window boundary.
  // Cloudflare KV requires expirationTtl >= 60 seconds.
  const ttl = Math.max(60, reset - now);

  const key = `rl:${identifier}:${windowSlot}`;

  try {
    const raw = await cache.get(key);

    if (raw === null) {
      // First request in this window — create key with TTL anchored to window end.
      await cache.put(key, '1', { expirationTtl: ttl });
      return { allowed: true, remaining: limit - 1, limit, reset };
    }

    const current = parseInt(raw, 10);
    if (current >= limit) {
      return { allowed: false, remaining: 0, limit, reset };
    }

    // Increment counter. TTL is re-set to remaining window time so KV expiry
    // tracks the fixed window boundary, not the time of the last request.
    await cache.put(key, String(current + 1), { expirationTtl: ttl });
    return { allowed: true, remaining: limit - current - 1, limit, reset };
  } catch {
    // KV failure — degrade gracefully by allowing the request through.
    return { allowed: true, remaining: limit, limit, reset };
  }
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
export function applyRateLimitHeaders(
  setHeader: (name: string, value: string) => void,
  result: RateLimitResult,
): void {
  setHeader('X-RateLimit-Limit', String(result.limit));
  setHeader('X-RateLimit-Remaining', String(result.remaining));
  setHeader('X-RateLimit-Reset', String(result.reset));
  if (!result.allowed) {
    // Retry-After is the number of seconds until the window resets
    const now = Math.floor(Date.now() / 1000);
    setHeader('Retry-After', String(Math.max(1, result.reset - now)));
  }
}
