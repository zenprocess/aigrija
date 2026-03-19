/**
 * API route coverage — ensures every registered endpoint returns a valid response.
 * Covers routes not hit by other E2E specs.
 */
import { test, expect } from '@playwright/test';

const BASE = '';

// ── GET endpoints ────────────────────────────────────────────────────────────

test.describe('API coverage — GET endpoints', () => {
  test('GET / returns 200 with HTML', async ({ request }) => {
    const res = await request.get(`${BASE}/`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
  });

  test('GET /health/deep returns 200 with status and endpoints', async ({ request }) => {
    const res = await request.get(`${BASE}/health/deep`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('endpoints');
  });

  test('GET /api/health/metrics returns 200 with bindings', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('bindings');
  });

  test('GET /api/alerts/emerging returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/alerts/emerging`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('GET /api/alerts/:slug returns 200 or 404 for known slug', async ({ request }) => {
    // First get a valid slug from the alerts list
    const listRes = await request.get(`${BASE}/api/alerts`);
    const alerts = await listRes.json();
    const items = alerts.campaigns ?? alerts;
    if (Array.isArray(items) && items.length > 0) {
      const slug = items[0].slug;
      const res = await request.get(`${BASE}/api/alerts/${slug}`);
      expect([200, 301, 302]).toContain(res.status());
    } else {
      // No campaigns — verify endpoint returns structured response
      const res = await request.get(`${BASE}/api/alerts/test-nonexistent`);
      expect([404, 200]).toContain(res.status());
    }
  });

  test('GET /api/digest/latest returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/digest/latest`);
    // May return 200 with digest or 503 if no digest exists yet
    expect([200, 503]).toContain(res.status());
  });

  test('GET /api/reports returns 200 with array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reports`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.reports ?? body)).toBe(true);
  });
});

// ── POST endpoints ───────────────────────────────────────────────────────────

test.describe('API coverage — POST endpoints', () => {
  test('POST /api/quiz/check with valid answer returns 200', async ({ request }) => {
    // First get a question ID from the quiz
    const quizRes = await request.get(`${BASE}/api/quiz`);
    expect(quizRes.status()).toBe(200);
    const quiz = await quizRes.json();
    const questions = quiz.questions ?? quiz;
    if (Array.isArray(questions) && questions.length > 0) {
      const q = questions[0];
      const res = await request.post(`${BASE}/api/quiz/check`, {
        data: { questionId: q.id, answer: true },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('correct');
    }
  });

  test('POST /api/check/image returns 400 without image', async ({ request }) => {
    const res = await request.post(`${BASE}/api/check/image`, {
      multipart: {
        text: 'test message without image',
      },
    });
    // Should return 400 (no image) or 422 (validation error)
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/digest/subscribe with valid email returns expected status', async ({ request }) => {
    const res = await request.post(`${BASE}/api/digest/subscribe`, {
      data: { email: `e2e-test-${Date.now()}@example.com` },
    });
    // 200 = subscribed, 400 = validation, 429 = rate limited, 502 = upstream, 503 = no API key
    expect([200, 400, 429, 502, 503]).toContain(res.status());
  });

  test('POST /api/digest/unsubscribe with valid email returns 2xx or 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/digest/unsubscribe`, {
      data: { email: 'nonexistent@example.com' },
    });
    // 200 = unsubscribed, 404 = not found, 429 = rate limited, 503 = no API key
    expect([200, 404, 429, 503]).toContain(res.status());
  });

  test('POST /api/reports/:id/vote returns 400 for invalid vote', async ({ request }) => {
    const res = await request.post(`${BASE}/api/reports/test-id/vote`, {
      data: { vote: 'invalid' },
    });
    // 400 = bad vote value, 404 = report not found
    expect([400, 404]).toContain(res.status());
  });

  test('POST /api/translation-report returns 400 without required fields', async ({ request }) => {
    const res = await request.post(`${BASE}/api/translation-report`, {
      data: {},
    });
    // 400 = missing fields, 422 = validation error
    expect([400, 422]).toContain(res.status());
  });
});
