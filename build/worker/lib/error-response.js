export function errorResponse(c, status, code, message) {
    return c.json({
        error: { code, message },
        request_id: (c.get('requestId')) || 'unknown',
    }, status);
}
export function setRateLimitHeaders(c, limit, remaining, reset) {
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(reset));
}
