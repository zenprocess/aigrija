import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { errorResponse, setRateLimitHeaders } from './error-response';

describe('errorResponse', () => {
  it('returns correct error JSON structure', async () => {
    const app = new Hono();
    app.get('/test', (c) => errorResponse(c, 400, 'INVALID_INPUT', 'Input invalid'));
    const res = await app.request('/test');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
    expect(body.error.message).toBe('Input invalid');
    expect(body).toHaveProperty('request_id');
  });

  it('returns 500 for server errors', async () => {
    const app = new Hono();
    app.get('/test', (c) => errorResponse(c, 500, 'INTERNAL_ERROR', 'Eroare interna'));
    const res = await app.request('/test');
    expect(res.status).toBe(500);
  });
});

describe('setRateLimitHeaders', () => {
  it('sets all rate limit headers', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      setRateLimitHeaders(c, 100, 42, 1700000000);
      return c.text('ok');
    });
    const res = await app.request('/test');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('42');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('1700000000');
  });
});
