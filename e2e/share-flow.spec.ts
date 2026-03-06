import { test, expect } from '@playwright/test';

const PHISHING_TEXT =
  'Contul dvs ING a fost blocat. Accesati urgent: http://ing-verify-fake.com/deblocare pentru a evita blocarea permanenta.';

test.describe('Share flow — post-analysis share/distribute', () => {
  test.setTimeout(45000);

  test('POST /api/check returns share_url matching /card/:hash', async ({ request }) => {
    const res = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.share_url).toBeDefined();
    expect(typeof body.share_url).toBe('string');
    expect(body.share_url).toMatch(/\/card\/[a-f0-9]+$/);
  });

  test('share card image endpoint returns SVG content', async ({ request }) => {
    // First, get a share URL from the check endpoint
    const checkRes = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    expect(checkRes.status()).toBe(200);

    const body = await checkRes.json();
    expect(body.share_url).toBeDefined();

    // Extract the hash from the share URL
    const match = body.share_url.match(/\/card\/([a-f0-9]+)$/);
    expect(match).toBeTruthy();
    const hash = match![1];

    // GET the card image endpoint — should return SVG, not a redirect
    const imageRes = await request.get(`/card/${hash}/image`);
    expect(imageRes.status()).toBe(200);

    const contentType = imageRes.headers()['content-type'] ?? '';
    expect(contentType).toContain('image/svg+xml');

    const svg = await imageRes.text();
    expect(svg).toContain('<svg');
  });

  test('share card HTML page returns OG meta tags', async ({ request }) => {
    const checkRes = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    expect(checkRes.status()).toBe(200);

    const body = await checkRes.json();
    const match = body.share_url.match(/\/card\/([a-f0-9]+)$/);
    expect(match).toBeTruthy();
    const hash = match![1];

    // GET the card HTML page
    const cardRes = await request.get(`/card/${hash}`);
    expect(cardRes.status()).toBe(200);

    const html = await cardRes.text();
    expect(html).toContain('og:image');
    expect(html).toContain('og:url');
    expect(html).toContain(`/card/${hash}`);
  });

  test('share_id is a hex string', async ({ request }) => {
    const res = await request.post('/api/check', { data: { text: PHISHING_TEXT } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.share_id).toBeDefined();
    expect(body.share_id).toMatch(/^[a-f0-9]+$/);
  });
});
