/**
 * Shared error helpers for consistent API error responses.
 *
 * All API error responses follow the envelope:
 *   { error: { code: string, message: string }, request_id: string }
 *
 * HTTP status is set on the response.
 *
 * This module re-exports the canonical errorResponse from error-response.ts
 * and adds typed convenience wrappers.
 */

export { errorResponse, setRateLimitHeaders } from './error-response';

import type { Context } from 'hono';

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

/** Build a raw error payload without a Hono context (for testing / reuse). */
export function buildErrorPayload(code: string, message: string, requestId = 'unknown') {
  return {
    error: { code, message },
    request_id: requestId,
  };
}

/** 400 Bad Request */
export function badRequest(c: Context, message: string, code = 'BAD_REQUEST') {
  return jsonError(c, 400, code, message);
}

/** 401 Unauthorized */
export function unauthorized(c: Context, message: string, code = 'UNAUTHORIZED') {
  return jsonError(c, 401, code, message);
}

/** 403 Forbidden */
export function forbidden(c: Context, message: string, code = 'FORBIDDEN') {
  return jsonError(c, 403, code, message);
}

/** 404 Not Found */
export function notFound(c: Context, message: string, code = 'NOT_FOUND') {
  return jsonError(c, 404, code, message);
}

/** 422 Unprocessable Entity */
export function unprocessable(c: Context, message: string, code = 'UNPROCESSABLE') {
  return jsonError(c, 422, code, message);
}

/** 429 Rate Limited */
export function rateLimited(c: Context, message: string, code = 'RATE_LIMITED') {
  c.header('Retry-After', '3600');
  return jsonError(c, 429, code, message);
}

/** 500 Internal Server Error */
export function internalError(c: Context, message: string, code = 'INTERNAL_ERROR') {
  return jsonError(c, 500, code, message);
}

/** 503 Service Unavailable */
export function serviceUnavailable(c: Context, message: string, code = 'SERVICE_UNAVAILABLE') {
  return jsonError(c, 503, code, message);
}

function jsonError(c: Context, status: ErrorStatus, code: string, message: string) {
  const requestId = (c.get('requestId' as never) as string) || 'unknown';
  return c.json({ error: { code, message }, request_id: requestId }, status);
}
