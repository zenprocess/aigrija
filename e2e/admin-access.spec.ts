/**
 * Admin access tests — verifies Cloudflare Access protects the admin panel.
 * GET pre-admin.ai-grija.ro should redirect (302) to cloudflareaccess.com.
 */
import { test, expect } from '@playwright/test';

test.describe('Admin — CF Access redirect', () => {
  test('GET pre-admin.ai-grija.ro returns 302 to cloudflareaccess.com', async ({ request }) => {
    const res = await request.get('https://pre-admin.ai-grija.ro', {
      maxRedirects: 0,
    });

    // Cloudflare Access returns 302 redirect to its login page
    expect(res.status()).toBe(302);

    const location = res.headers()['location'] ?? '';
    expect(location).toContain('cloudflareaccess.com');
  });
});
