import { describe, it, expect } from 'vitest';
import { app } from './index';

// ---- Mock helpers ----
function mockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}
function mockR2(): R2Bucket {
  return {
    head: async () => null,
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false }),
    createMultipartUpload: async () => ({}),
    resumeMultipartUpload: async () => ({}),
  } as unknown as R2Bucket;
}

// ---- #52: Admin auth bypass when ADMIN_API_KEY is empty string ----
describe('#52 Admin auth — empty ADMIN_API_KEY', () => {
  it('returns 503 when ADMIN_API_KEY is empty string', async () => {
    const env = { CACHE: mockKV(), ADMIN_API_KEY: '' };
    const res = await app.request(
      '/api/admin/flags',
      { method: 'GET', headers: { Authorization: 'Bearer ' } },
      env
    );
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.error.message).toBe('API de administrare nu este configurat.');
  });

  it('returns 503 when ADMIN_API_KEY is whitespace only', async () => {
    const env = { CACHE: mockKV(), ADMIN_API_KEY: '   ' };
    const res = await app.request(
      '/api/admin/flags',
      { method: 'GET', headers: { Authorization: 'Bearer    ' } },
      env
    );
    expect(res.status).toBe(503);
  });

  it('returns 401 when valid key is set but wrong token sent', async () => {
    const env = { CACHE: mockKV(), ADMIN_API_KEY: 'real-secret' };
    const res = await app.request(
      '/api/admin/flags',
      { method: 'GET', headers: { Authorization: 'Bearer wrong' } },
      env
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 when correct ADMIN_API_KEY is provided', async () => {
    const env = { CACHE: mockKV(), ADMIN_API_KEY: 'real-secret' };
    const res = await app.request(
      '/api/admin/flags',
      { method: 'GET', headers: { Authorization: 'Bearer real-secret' } },
      env
    );
    expect(res.status).toBe(200);
  });
});

// ---- #57: UUID v4 validation on /api/share/:id ----
describe('#57 Share ID — UUID v4 validation', () => {
  it('returns 400 for non-UUID share ID', async () => {
    const env = { STORAGE: mockR2() };
    const res = await app.request('/api/share/not-a-uuid', undefined, env);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBeDefined();
  });

  it('returns 400 for UUID v1 (not v4)', async () => {
    const env = { STORAGE: mockR2() };
    // UUID v1: version digit is 1
    const res = await app.request('/api/share/550e8400-e29b-11d4-a716-446655440000', undefined, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 for UUID v3', async () => {
    const env = { STORAGE: mockR2() };
    const res = await app.request('/api/share/550e8400-e29b-31d4-a716-446655440000', undefined, env);
    expect(res.status).toBe(400);
  });

  it('returns 404 for valid UUID v4 that does not exist in R2', async () => {
    const env = { STORAGE: mockR2() };
    const res = await app.request('/api/share/550e8400-e29b-4000-a716-446655440000', undefined, env);
    expect(res.status).toBe(404);
  });

  it('returns 400 for SQL injection attempt as share ID', async () => {
    const env = { STORAGE: mockR2() };
    const res = await app.request("/api/share/'; DROP TABLE shares; --", undefined, env);
    expect(res.status).toBe(400);
  });
});

// ---- #50: XSS in /og/:type ----
describe('#50 OG route — XSS prevention', () => {
  it('escapes HTML special chars in verdict OG page scam_type', async () => {
    const env = { BASE_URL: 'https://ai-grija.ro' };
    const xssPayload = encodeURIComponent('<script>alert(1)</script>');
    const res = await app.request(
      `/og/verdict?verdict=phishing&confidence=90&scam_type=${xssPayload}`,
      undefined,
      env
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('"<script>');
  });

  it('escapes HTML special chars in alert OG page title', async () => {
    const env = { BASE_URL: 'https://ai-grija.ro' };
    const xssPayload = encodeURIComponent('"><script>alert(1)</script>');
    const res = await app.request(
      `/og/alert?title=${xssPayload}&description=test`,
      undefined,
      env
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('"><script>');
  });

  it('returns 400 for unknown og type', async () => {
    const env = { BASE_URL: 'https://ai-grija.ro' };
    const res = await app.request('/og/unknown', undefined, env);
    expect(res.status).toBe(400);
  });
});

// ---- #53: Rate limit on GET /api/report/:type ----
describe('#53 Report rate limiting', () => {
  it('returns 200 for valid report type', async () => {
    const env = { CACHE: mockKV() };
    const res = await app.request('/api/report/raport-dnsc', undefined, env);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid report type', async () => {
    const env = { CACHE: mockKV() };
    const res = await app.request('/api/report/nonexistent-type', undefined, env);
    expect(res.status).toBe(400);
  });

  it('returns rate limit headers', async () => {
    const env = { CACHE: mockKV() };
    const res = await app.request('/api/report/raport-dnsc', undefined, env);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});

// ---- #54: Counter endpoint is read-only ----
describe('#54 Counter — read-only public endpoint', () => {
  it('GET /api/counter returns count', async () => {
    const env = { CACHE: mockKV() };
    const res = await app.request('/api/counter', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.total_checks).toBe('number');
  });

  it('POST /api/counter is not routed (no write handler)', async () => {
    const env = { CACHE: mockKV() };
    const res = await app.request('/api/counter', { method: 'POST' }, env);
    // Counter has no POST handler — Hono returns 404 (no route matched) or similar non-2xx
    expect(res.status).not.toBe(200);
  });
});
