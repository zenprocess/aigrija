/**
 * Routing boundary — static asset extensions must NOT return SPA HTML.
 * Verifies that requests for .js, .css, .png, .ico, .svg, .woff2 files
 * return their proper content type or 404, never the SPA catch-all HTML.
 */
import { test, expect } from '@playwright/test';

test.describe('Routing boundary — static assets must not return SPA HTML', () => {
  test('GET /sw.js returns 404 or application/javascript, NOT text/html', async ({ request }) => {
    const res = await request.get('/sw.js');
    const ct = res.headers()['content-type'] ?? '';
    if (res.status() === 200) {
      expect(ct).toContain('javascript');
      expect(ct).not.toContain('text/html');
    } else {
      expect(res.status()).toBe(404);
    }
  });

  test('GET /nonexistent.js returns 404, NOT SPA HTML', async ({ request }) => {
    const res = await request.get('/nonexistent.js');
    const ct = res.headers()['content-type'] ?? '';
    expect(res.status()).toBe(404);
    expect(ct).not.toContain('text/html');
  });

  test('GET /nonexistent.css returns 404, NOT SPA HTML', async ({ request }) => {
    const res = await request.get('/nonexistent.css');
    const ct = res.headers()['content-type'] ?? '';
    expect(res.status()).toBe(404);
    expect(ct).not.toContain('text/html');
  });

  test('GET /favicon.ico returns valid icon or 404', async ({ request }) => {
    const res = await request.get('/favicon.ico');
    const ct = res.headers()['content-type'] ?? '';
    if (res.status() === 200) {
      expect(ct).toMatch(/icon|octet-stream|x-icon/);
      expect(ct).not.toContain('text/html');
    } else {
      expect(res.status()).toBe(404);
    }
  });

  test('GET /nonexistent.png returns 404, NOT SPA HTML', async ({ request }) => {
    const res = await request.get('/nonexistent.png');
    const ct = res.headers()['content-type'] ?? '';
    expect(res.status()).toBe(404);
    expect(ct).not.toContain('text/html');
  });

  test('GET /nonexistent.svg returns 404, NOT SPA HTML', async ({ request }) => {
    const res = await request.get('/nonexistent.svg');
    const ct = res.headers()['content-type'] ?? '';
    expect(res.status()).toBe(404);
    expect(ct).not.toContain('text/html');
  });

  test('GET /nonexistent.woff2 returns 404, NOT SPA HTML', async ({ request }) => {
    const res = await request.get('/nonexistent.woff2');
    const ct = res.headers()['content-type'] ?? '';
    expect(res.status()).toBe(404);
    expect(ct).not.toContain('text/html');
  });
});
