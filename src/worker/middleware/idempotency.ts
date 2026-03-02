/**
 * Idempotency Key Middleware
 *
 * For POST/PUT endpoints that perform mutations, clients may send an
 * `Idempotency-Key` header to guarantee at-most-once semantics on retries.
 *
 * Behaviour:
 *   1. If the header is absent, the request proceeds normally (no caching).
 *   2. If the header is present and a cached response exists in KV, the cached
 *      response is returned immediately without re-executing the handler.
 *   3. If the header is present but no cached entry exists, the handler runs.
 *      The response body + status are stored in KV with a 24-hour TTL so that
 *      subsequent retries with the same key receive the identical response.
 *
 * KV key format: `idem:{sha256_hex_of_idempotency_key}`
 *
 * Only 2xx and 4xx responses are cached (not 5xx, so transient errors are
 * retried transparently).
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/types';

const TTL_SECONDS = 86_400; // 24 hours

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns a Hono middleware that enforces idempotency for the wrapped route.
 *
 * Usage (per-route, applied before the handler):
 *   app.post('/api/newsletter/subscribe', idempotency(), handler);
 *
 * Or applied globally to a sub-app with `.use()`.
 */
export function idempotency(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const key = c.req.header('Idempotency-Key');

    // No header — pass through without idempotency semantics
    if (!key) {
      await next();
      return;
    }

    const keyHash = await sha256Hex(key);
    const kvKey = `idem:${keyHash}`;
    const kv = c.env.CACHE;

    // Check for existing cached response
    const cached = await kv.get<CachedResponse>(kvKey, 'json');
    if (cached) {
      c.header('Idempotency-Replayed', 'true');
      // Re-apply cached headers (content-type etc.)
      for (const [hk, hv] of Object.entries(cached.headers)) {
        c.header(hk, hv);
      }
      return new Response(cached.body, { status: cached.status, headers: c.res.headers });
    }

    // Execute the actual handler
    await next();

    // Cache only 2xx and 4xx (not 5xx — transient server errors should be retried)
    const status = c.res.status;
    if ((status >= 200 && status < 300) || (status >= 400 && status < 500)) {
      // Clone the response body — reading it consumes the stream
      const responseText = await c.res.text();

      // Capture relevant headers
      const headersToCache: Record<string, string> = {};
      const contentType = c.res.headers.get('Content-Type');
      if (contentType) headersToCache['Content-Type'] = contentType;

      const payload: CachedResponse = {
        status,
        headers: headersToCache,
        body: responseText,
      };

      // Store in KV (fire-and-forget; don't block the response)
      c.executionCtx.waitUntil(
        kv.put(kvKey, JSON.stringify(payload), { expirationTtl: TTL_SECONDS })
      );

      // Reconstruct the response since we consumed the body stream
      c.res = new Response(responseText, {
        status,
        headers: c.res.headers,
      });
    }
  };
}
