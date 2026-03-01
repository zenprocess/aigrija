import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
test.describe('GET /health', () => {
  test('returns 200 with expected shape', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('kv');
    expect(body.checks).toHaveProperty('ai');
    expect(body.checks).toHaveProperty('r2');
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// POST /api/check
// ---------------------------------------------------------------------------
test.describe('POST /api/check', () => {
  test('classifies phishing-like text', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Urgent! Your bank account has been compromised. Click here to verify your credentials immediately: http://totally-not-phishing.ru/login',
      },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toBeTruthy();
    expect(typeof body).toBe('object');
  });

  test('accepts optional url field', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Please verify your PayPal account now.',
        url: 'http://paypal-secure-verify.ru/confirm',
      },
    });
    expect(res.status()).toBe(200);
  });

  test('returns 400 for empty text', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'test content for checking request id header' },
    });
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/alerts
// ---------------------------------------------------------------------------
test.describe('GET /api/alerts', () => {
  test('returns 200 with campaigns array', async ({ request }) => {
    const res = await request.get('/api/alerts');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  test('?status=active filter returns 200', async ({ request }) => {
    const res = await request.get('/api/alerts?status=active');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('campaigns');
  });

  test('?status=invalid returns 400', async ({ request }) => {
    const res = await request.get('/api/alerts?status=invalid');
    expect(res.status()).toBe(400);
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/api/alerts');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/counter
// ---------------------------------------------------------------------------
test.describe('GET /api/counter', () => {
  test('returns 200 with count number', async ({ request }) => {
    const res = await request.get('/api/counter');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.total_checks).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// GET /api/feed/latest
// ---------------------------------------------------------------------------
test.describe('GET /api/feed/latest', () => {
  test('returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/feed/latest');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------------------
test.describe('GET /api/stats', () => {
  test('returns 200 with total_checks field', async ({ request }) => {
    const res = await request.get('/api/stats');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total_checks');
  });
});

// ---------------------------------------------------------------------------
// GET /api/badges
// ---------------------------------------------------------------------------
test.describe('GET /api/badges', () => {
  test('returns 200 with verified_by field', async ({ request }) => {
    const res = await request.get('/api/badges');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('verified_by');
  });
});

// ---------------------------------------------------------------------------
// GET /api/openapi.json
// ---------------------------------------------------------------------------
test.describe('GET /api/openapi.json', () => {
  test('returns 200 with valid OpenAPI spec', async ({ request }) => {
    const res = await request.get('/api/openapi.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('openapi');
    expect(body).toHaveProperty('info');
    expect(body).toHaveProperty('paths');
  });
});

// ---------------------------------------------------------------------------
// GET /docs  — Swagger UI (chanfana)
// ---------------------------------------------------------------------------
test.describe('GET /docs', () => {
  test('returns 200 with HTML content-type', async ({ request }) => {
    const res = await request.get('/docs', {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('html');
  });
});

// ---------------------------------------------------------------------------
// GET /sitemap.xml
// ---------------------------------------------------------------------------
test.describe('GET /sitemap.xml', () => {
  test('returns 200 with XML content', async ({ request }) => {
    const res = await request.get('/sitemap.xml', {
      headers: { Accept: 'application/xml,text/xml,*/*' },
    });
    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toContain('<?xml');
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});
