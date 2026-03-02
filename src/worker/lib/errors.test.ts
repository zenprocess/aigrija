import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  unprocessable,
  rateLimited,
  internalError,
  serviceUnavailable,
} from './errors';

function makeApp(handler: (c: any) => Response | Promise<Response>) {
  const app = new Hono();
  app.get('/test', handler);
  return app;
}

async function req(app: Hono, accept?: string) {
  const headers: Record<string, string> = {};
  if (accept) headers['Accept'] = accept;
  return app.request('/test', { headers });
}

describe('errors — JSON responses (API consumers)', () => {
  const cases: Array<[string, (c: any) => any, number, string]> = [
    ['badRequest', (c) => badRequest(c, 'bad'), 400, 'BAD_REQUEST'],
    ['unauthorized', (c) => unauthorized(c, 'unauth'), 401, 'UNAUTHORIZED'],
    ['forbidden', (c) => forbidden(c, 'forbidden'), 403, 'FORBIDDEN'],
    ['notFound', (c) => notFound(c, 'not found'), 404, 'NOT_FOUND'],
    ['unprocessable', (c) => unprocessable(c, 'unprocessable'), 422, 'UNPROCESSABLE'],
    ['internalError', (c) => internalError(c, 'oops'), 500, 'INTERNAL_ERROR'],
    ['serviceUnavailable', (c) => serviceUnavailable(c, 'down'), 503, 'SERVICE_UNAVAILABLE'],
  ];

  cases.forEach(([name, handler, status, code]) => {
    it(`${name} returns JSON with correct status and code`, async () => {
      const app = makeApp(handler);
      const res = await req(app, 'application/json');
      expect(res.status).toBe(status);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      expect(body.error.code).toBe(code);
      expect(body.request_id).toBeDefined();
    });
  });

  it('no Accept header defaults to JSON', async () => {
    const app = makeApp((c) => badRequest(c, 'test'));
    const res = await req(app);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('Accept: */* returns JSON (curl / backwards compat)', async () => {
    const app = makeApp((c) => badRequest(c, 'test'));
    const res = await req(app, '*/*');
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

describe('errors — HTML responses (browser Accept: text/html)', () => {
  const cases: Array<[string, (c: any) => any, number]> = [
    ['badRequest', (c) => badRequest(c, 'bad'), 400],
    ['notFound', (c) => notFound(c, 'not found'), 404],
    ['internalError', (c) => internalError(c, 'oops'), 500],
    ['serviceUnavailable', (c) => serviceUnavailable(c, 'down'), 503],
  ];

  cases.forEach(([name, handler, status]) => {
    it(`${name} returns HTML for browser Accept header`, async () => {
      const app = makeApp(handler);
      const res = await req(app, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
      expect(res.status).toBe(status);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<!DOCTYPE html>');
      expect(body).toContain('<html lang="ro">');
      expect(body).toContain('<svg');
    });
  });

  it('explicit application/json in Accept bypasses HTML even with text/html present', async () => {
    const app = makeApp((c) => badRequest(c, 'test'));
    const res = await req(app, 'text/html,application/json');
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('rateLimited', () => {
  it('sets Retry-After header and returns JSON for API', async () => {
    const app = makeApp((c) => rateLimited(c, 'too many'));
    const res = await req(app, 'application/json');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('sets Retry-After header and returns HTML for browser', async () => {
    const app = makeApp((c) => rateLimited(c, 'too many'));
    const res = await req(app, 'text/html');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
  });
});
