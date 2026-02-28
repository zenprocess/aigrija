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
    // Classification result must contain at minimum a verdict/label field
    expect(body).toBeTruthy();
    // The response is an object (not an error string)
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

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'test content' },
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
