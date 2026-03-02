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
/** Build a raw error payload without a Hono context (for testing / reuse). */
export function buildErrorPayload(code, message, requestId = 'unknown') {
    return {
        error: { code, message },
        request_id: requestId,
    };
}
/** 400 Bad Request */
export function badRequest(c, message, code = 'BAD_REQUEST') {
    return jsonError(c, 400, code, message);
}
/** 401 Unauthorized */
export function unauthorized(c, message, code = 'UNAUTHORIZED') {
    return jsonError(c, 401, code, message);
}
/** 403 Forbidden */
export function forbidden(c, message, code = 'FORBIDDEN') {
    return jsonError(c, 403, code, message);
}
/** 404 Not Found */
export function notFound(c, message, code = 'NOT_FOUND') {
    return jsonError(c, 404, code, message);
}
/** 422 Unprocessable Entity */
export function unprocessable(c, message, code = 'UNPROCESSABLE') {
    return jsonError(c, 422, code, message);
}
/** 429 Rate Limited */
export function rateLimited(c, message, code = 'RATE_LIMITED') {
    c.header('Retry-After', '3600');
    return jsonError(c, 429, code, message);
}
/** 500 Internal Server Error */
export function internalError(c, message, code = 'INTERNAL_ERROR') {
    return jsonError(c, 500, code, message);
}
/** 503 Service Unavailable */
export function serviceUnavailable(c, message, code = 'SERVICE_UNAVAILABLE') {
    return jsonError(c, 503, code, message);
}
function jsonError(c, status, code, message) {
    const requestId = (c.get('requestId')) || 'unknown';
    return c.json({ error: { code, message }, request_id: requestId }, status);
}
