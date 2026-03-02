import { test, expect } from '@playwright/test';

test.describe('POST /webhook/telegram', () => {
  test('returns 401 without secret header', async ({ request }) => {
    const res = await request.post('/webhook/telegram', {
      data: { update_id: 1, message: { text: 'hello' } },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with wrong secret header', async ({ request }) => {
    const res = await request.post('/webhook/telegram', {
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret-value' },
      data: { update_id: 1, message: { text: 'hello' } },
    });
    expect(res.status()).toBe(401);
  });

  test('returns non-5xx status for structurally valid request', async ({ request }) => {
    // Without the real secret we cannot get 200, but we should not get a 500
    const res = await request.post('/webhook/telegram', {
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret' },
      data: { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, text: '/start' } },
    });
    // Will be 401 (wrong secret) — not a server error
    expect(res.status()).toBeLessThan(500);
  });
});
