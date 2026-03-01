import type { Context } from 'hono';

export function errorResponse(
  c: Context,
  status: number,
  code: string,
  message: string
) {
  return c.json(
    {
      error: { code, message },
      request_id: (c.get('requestId' as never) as string) || 'unknown',
    },
    status as 400 | 401 | 403 | 404 | 429 | 500
  );
}

export function setRateLimitHeaders(
  c: Context,
  limit: number,
  remaining: number,
  reset: number
) {
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(reset));
}
