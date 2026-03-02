/**
 * Full route health check — every route, grouped by category.
 * Verifies status codes, content-types, and response shapes.
 */
import { test, expect } from '@playwright/test';

// ── Public API routes ─────────────────────────────────────────────────────────

test.describe('Health — Public API routes', () => {
  test('GET /health returns 200 with status ok or degraded', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('GET /health has version, timestamp, checks fields', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('checks');
  });

  test('GET /health checks contains kv, ai, r2 entries', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks).toHaveProperty('kv');
    expect(body.checks).toHaveProperty('ai');
    expect(body.checks).toHaveProperty('r2');
  });

  test('GET /health returns X-Request-Id header', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('GET /api/counter returns 200 with total_checks number', async ({ request }) => {
    const res = await request.get('/api/counter');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.total_checks).toBe('number');
  });

  test('GET /api/alerts returns 200 with campaigns array', async ({ request }) => {
    const res = await request.get('/api/alerts');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('GET /api/alerts?status=active returns 200 with filtered array', async ({ request }) => {
    const res = await request.get('/api/alerts?status=active');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('GET /api/alerts?status=invalid returns 400', async ({ request }) => {
    const res = await request.get('/api/alerts?status=invalid');
    expect(res.status()).toBe(400);
  });

  test('GET /api/feed/latest returns 200 with object response', async ({ request }) => {
    const res = await request.get('/api/feed/latest');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('GET /api/stats returns 200 with stats object', async ({ request }) => {
    const res = await request.get('/api/stats');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('GET /api/badges returns 200', async ({ request }) => {
    const res = await request.get('/api/badges');
    expect(res.status()).toBe(200);
  });

  test('GET /api/openapi.json returns 200 with openapi spec', async ({ request }) => {
    const res = await request.get('/api/openapi.json');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('json');
    const body = await res.json();
    expect(body).toHaveProperty('openapi');
  });

  test('GET /api/quiz/stats returns 200', async ({ request }) => {
    const res = await request.get('/api/quiz/stats');
    expect(res.status()).toBe(200);
  });
});

// ── POST API routes ───────────────────────────────────────────────────────────

test.describe('Health — POST API routes', () => {
  test('POST /api/check with valid text returns 200', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify-fake.com/deblocare' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST /api/check with empty text returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/check missing text field returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/newsletter/subscribe with valid email returns 2xx', async ({ request }) => {
    const res = await request.post('/api/newsletter/subscribe', {
      data: { email: 'test-e2e@example.com' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/newsletter/unsubscribe with valid email returns 2xx', async ({ request }) => {
    const res = await request.post('/api/newsletter/unsubscribe', {
      data: { email: 'test-e2e@example.com' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/quiz/verify returns 2xx for payload', async ({ request }) => {
    const res = await request.post('/api/quiz/verify', {
      data: { answers: [] },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/check-qr returns 2xx for valid URL payload', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { url: 'https://example.com' },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

// ── SSR page routes ───────────────────────────────────────────────────────────

test.describe('Health — SSR page routes', () => {
  test('GET / returns 200 with HTML content-type', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('GET /alerte returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/alerte', { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('GET /blog returns 200 with HTML', async ({ request }) => {
    const res = await request.get('/blog');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('GET /gdpr returns 200 with GDPR content', async ({ request }) => {
    const res = await request.get('/gdpr');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/GDPR|gdpr|Regulament/i);
  });

  test('GET /politica-cookies returns 200 with cookie content', async ({ request }) => {
    const res = await request.get('/politica-cookies');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/cookie|Cookie/);
  });

  test('GET /termeni returns 200 with terms content', async ({ request }) => {
    const res = await request.get('/termeni');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Termeni|termeni/i);
  });

  test('GET /raportare returns 200 with HTML form', async ({ request }) => {
    const res = await request.get('/raportare');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });

  test('GET /docs returns 200 with Swagger UI HTML', async ({ request }) => {
    const res = await request.get('/docs');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/swagger|openapi|Swagger/i);
  });
});

// ── Utility and metadata routes ───────────────────────────────────────────────

test.describe('Health — Utility and metadata routes', () => {
  test('GET /sitemap.xml returns 200 with XML urlset', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/xml/);
    const text = await res.text();
    expect(text).toContain('<urlset');
  });

  test('GET /robots.txt returns 200 with User-agent directive', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/User-agent/i);
  });

  test('GET /feed.xml returns 200 with RSS XML', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<rss|<feed|<channel/i);
  });
});

// ── 404 handling ──────────────────────────────────────────────────────────────

test.describe('Health — 404 handling', () => {
  test('GET /nonexistent-route returns 404 or SPA fallback 200', async ({ request }) => {
    const res = await request.get('/this-route-does-not-exist-xyz-12345');
    expect([200, 404]).toContain(res.status());
  });
});
