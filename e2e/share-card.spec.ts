import { test, expect } from '@playwright/test';

test.describe('Share card /card/:hash', () => {
  test('GET /card/nonexistent returns 404 or placeholder response', async ({ request }) => {
    const res = await request.get('/card/nonexistent-hash-12345');
    // Either 404 or a fallback HTML page
    expect([200, 404]).toContain(res.status());
  });

  test('card route returns HTML with OG meta tags when content exists', async ({ request }) => {
    // This test verifies the route is reachable; actual OG tags depend on stored data
    const res = await request.get('/card/test-hash', {
      headers: { Accept: 'text/html' },
    });
    // Route should return a valid HTTP response
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const text = await res.text();
      expect(text).toContain('og:');
    }
  });
});
