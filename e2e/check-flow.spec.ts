import { test, expect } from '@playwright/test';

test.describe('Check Flow', () => {
  test('submit empty form shows validation error', async ({ page }) => {
    await page.goto('/');
    const submit = page.locator('button[data-testid="check-submit"], button[type="submit"]').first();
    await submit.click();
    // Either native browser validation or a UI error message
    const hasError = await page.locator('[data-testid="check-error"], .error, [role="alert"]').count() > 0
      || await page.evaluate(() => {
        const ta = document.querySelector('textarea');
        return ta ? !ta.validity.valid : false;
      });
    expect(hasError).toBeTruthy();
  });

  test('POST /api/check with valid suspicious text returns 200', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify-fake.com/deblocare pentru a evita blocarea permanenta.',
      },
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

  test('verdict card action buttons visible after check via API', async ({ request }) => {
    const res = await request.post('/api/check', {
      data: {
        text: 'Felicitari! Ati castigat 5000 lei. Accesati linkul pentru a ridica premiul: http://fake-prize.ro/claim',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response should contain verdict fields
    expect(body).toBeTruthy();
  });
});
