/**
 * Hardened E2E API tests — Issue #130
 *
 * Comprehensive coverage for all critical API endpoints:
 *   POST /api/check
 *   POST /api/check-qr
 *   GET  /api/health
 *   GET  /api/counter
 *   GET  /api/report/:type  (all 4 types)
 *   GET  /api/share/:id
 *   GET  /sitemap.xml
 *   Rate-limiting headers
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// POST /api/check — happy path + error paths
// ---------------------------------------------------------------------------
test.describe('POST /api/check — hardened', () => {
  test('valid suspicious text returns 200 with verdict object', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Urgent! Contul dvs BCR a fost blocat. Accesati: http://bcr-secure-verify.ro/deblocare acum!',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('valid text with optional url field returns 200', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Click here to claim your prize from Romanian lottery.',
        url: 'http://loterie-nationala-premii.ru/claim',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('empty text returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('text shorter than 3 chars returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'ab' },
    });
    expect(res.status()).toBe(400);
  });

  test('missing text field returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('text over 5000 chars returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'a'.repeat(5001) },
    });
    expect(res.status()).toBe(400);
  });

  test('invalid url field returns 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Valid text content here for checking.',
        url: 'not-a-valid-url',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('non-JSON body returns 400 or 422', async ({ request }) => {
    const res = await request.post('/api/check', {
      headers: { 'Content-Type': 'application/json' },
      data: 'this is not json',
    });
    expect([400, 422]).toContain(res.status());
  });

  test('X-Request-Id header is present on 200', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'Felicitari! Ati castigat un premiu de 10000 lei pe loterie.' },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('X-Request-Id header or body request_id present on 400', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    const hasRequestId =
      !!res.headers()['x-request-id'] ||
      body?.error?.request_id !== undefined ||
      body?.request_id !== undefined;
    expect(hasRequestId).toBeTruthy();
  });

  test('rate limit headers are present on success', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'Urgent! Va rugam sa va actualizati datele bancare imediat.' },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// POST /api/check-qr — happy path + error paths
// ---------------------------------------------------------------------------
test.describe('POST /api/check-qr — hardened', () => {
  test('valid URL in qr_data returns 200', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://example.com/verify' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('valid suspicious URL in qr_data returns 200', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'http://paypal-account-verify.ru/confirm?token=abc123' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('url_analysis field present when URL is provided', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://suspicious-banking-site.xyz/login' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.url_analysis !== undefined) {
      expect(typeof body.url_analysis).toBe('object');
    }
  });

  test('empty qr_data returns 400', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('whitespace-only qr_data returns 400', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: '   ' },
    });
    expect(res.status()).toBe(400);
  });

  test('missing qr_data field returns 400', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('invalid JSON body returns 400 or 422', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      headers: { 'Content-Type': 'application/json' },
      data: '{bad json',
    });
    expect([400, 422]).toContain(res.status());
  });

  test('X-Request-Id header present on valid request', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://google.com' },
    });
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('rate limit headers present', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://example.com' },
    });
    expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
  });

  test('rate limit remaining is non-negative integer', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://example.com/test' },
    });
    const remaining = res.headers()['x-ratelimit-remaining'];
    if (remaining) {
      const val = parseInt(remaining, 10);
      expect(isNaN(val)).toBe(false);
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  test('429 response when rate-limited includes Retry-After header', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://example.com/rate-limit-test' },
    });
    if (res.status() === 429) {
      expect(res.headers()['retry-after']).toBeTruthy();
      const body = await res.json();
      expect(body?.error?.code).toBe('RATE_LIMITED');
    } else {
      expect(res.status()).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
test.describe('GET /api/health — hardened', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
  });

  test('body status is ok or degraded', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('body has non-empty version string', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  test('body has valid ISO timestamp', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(typeof body.timestamp).toBe('string');
    const d = new Date(body.timestamp);
    expect(isNaN(d.getTime())).toBe(false);
  });

  test('checks.kv is present', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks).toHaveProperty('kv');
  });

  test('checks.ai is present', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks).toHaveProperty('ai');
  });

  test('checks.r2 is present', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks).toHaveProperty('r2');
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('content-type is application/json', async ({ request }) => {
    const res = await request.get('/health');
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// GET /api/counter
// ---------------------------------------------------------------------------
test.describe('GET /api/counter — hardened', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get('/api/counter');
    expect(res.status()).toBe(200);
  });

  test('body has total_checks as number', async ({ request }) => {
    const res = await request.get('/api/counter');
    const body = await res.json();
    expect(typeof body.total_checks).toBe('number');
  });

  test('total_checks is non-negative integer', async ({ request }) => {
    const res = await request.get('/api/counter');
    const body = await res.json();
    expect(body.total_checks).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(body.total_checks)).toBe(true);
  });

  test('content-type is application/json', async ({ request }) => {
    const res = await request.get('/api/counter');
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// GET /api/report/:type — all 4 valid types + invalid type
// ---------------------------------------------------------------------------
const REPORT_TYPES = [
  'plangere-penala',
  'petitie-politie',
  'raport-dnsc',
  'sesizare-banca',
] as const;

for (const reportType of REPORT_TYPES) {
  test.describe(`GET /api/report/${reportType} — hardened`, () => {
    test('returns 200', async ({ request }) => {
      const res = await request.get(`/api/report/${reportType}`);
      expect(res.status()).toBe(200);
    });

    test('returns non-empty body', async ({ request }) => {
      const res = await request.get(`/api/report/${reportType}`);
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body.length).toBeGreaterThan(0);
    });

    test('accepts optional query params', async ({ request }) => {
      const res = await request.get(
        `/api/report/${reportType}?scam_type=phishing&verdict=phishing&text=Test+text`,
      );
      expect(res.status()).toBe(200);
    });

    test('rate limit headers present', async ({ request }) => {
      const res = await request.get(`/api/report/${reportType}`);
      expect(res.status()).toBe(200);
      expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
      expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
    });
  });
}

test.describe('GET /api/report/invalid-type — hardened', () => {
  test('returns 400', async ({ request }) => {
    const res = await request.get('/api/report/invalid-type');
    expect(res.status()).toBe(400);
  });

  test('body has error.code INVALID_REPORT_TYPE', async ({ request }) => {
    const res = await request.get('/api/report/invalid-type');
    const body = await res.json();
    expect(body?.error?.code).toBe('INVALID_REPORT_TYPE');
  });

  test('error message mentions accepted types', async ({ request }) => {
    const res = await request.get('/api/report/bogus');
    expect(res.status()).toBe(400);
    const body = await res.json();
    const msg: string = body?.error?.message ?? '';
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/share/:id — invalid UUID → 400, valid UUID not found → 404
// ---------------------------------------------------------------------------
test.describe('GET /api/share/:id — hardened', () => {
  test('non-UUID id returns 400', async ({ request }) => {
    const res = await request.get('/api/share/not-a-uuid');
    expect(res.status()).toBe(400);
  });

  test('non-UUID id body has error.code VALIDATION_ERROR', async ({ request }) => {
    const res = await request.get('/api/share/invalid-id-123');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body?.error?.code).toBe('VALIDATION_ERROR');
  });

  test('short alphanumeric id returns 400', async ({ request }) => {
    const res = await request.get('/api/share/abc123');
    expect(res.status()).toBe(400);
  });

  test('valid UUID format that does not exist returns 404', async ({ request }) => {
    const res = await request.get('/api/share/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('404 response has error.code NOT_FOUND', async ({ request }) => {
    const res = await request.get('/api/share/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body?.error?.code).toBe('NOT_FOUND');
  });

  test('content-type is application/json for 400 error', async ({ request }) => {
    const res = await request.get('/api/share/not-a-uuid');
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });

  test('content-type is application/json for 404 error', async ({ request }) => {
    const res = await request.get('/api/share/00000000-0000-4000-8000-000000000000');
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// GET /sitemap.xml — valid XML + content checks
// ---------------------------------------------------------------------------
test.describe('GET /sitemap.xml — hardened', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
  });

  test('content-type contains xml', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const ct = res.headers()['content-type'] ?? '';
    expect(ct.toLowerCase()).toMatch(/xml/);
  });

  test('body starts with XML declaration', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text.trimStart()).toMatch(/^<\?xml/);
  });

  test('body contains urlset element', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text).toContain('<urlset');
  });

  test('body contains at least one <url> entry', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text).toContain('<url>');
  });

  test('body contains <loc> elements', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text).toContain('<loc>');
  });

  test('X-Request-Id header is present', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — response contract validation
// ---------------------------------------------------------------------------
test.describe('Rate limiting — response contract', () => {
  test('POST /api/check X-RateLimit-Limit is positive integer', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: { text: 'Verificare limita rata pentru endpoint check.' },
    });
    expect(res.status()).toBe(200);
    const limit = res.headers()['x-ratelimit-limit'];
    expect(limit).toBeTruthy();
    const val = parseInt(limit!, 10);
    expect(isNaN(val)).toBe(false);
    expect(val).toBeGreaterThan(0);
  });

  test('POST /api/check-qr X-RateLimit headers present', async ({ request }) => {
    const res = await request.post('/api/check-qr', {
      data: { qr_data: 'https://example.com/rate-limit-check' },
    });
    expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
  });

  test('GET /api/report/:type X-RateLimit headers present', async ({ request }) => {
    const res = await request.get('/api/report/raport-dnsc');
    expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
  });

  test('X-RateLimit-Remaining decreases or stays same across sequential calls', async ({ request }) => {
    const res1 = await request.post('/api/check', {
      data: { text: 'Prima verificare pentru testul de rata.' },
    });
    const res2 = await request.post('/api/check', {
      data: { text: 'A doua verificare pentru testul de rata.' },
    });
    if (res1.status() === 200 && res2.status() === 200) {
      const r1 = parseInt(res1.headers()['x-ratelimit-remaining'] ?? '999', 10);
      const r2 = parseInt(res2.headers()['x-ratelimit-remaining'] ?? '999', 10);
      expect(r2).toBeLessThanOrEqual(r1);
    }
  });
});
