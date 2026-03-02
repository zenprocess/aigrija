import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cdnProtection } from './cdn-protection';

function buildApp() {
  const app = new Hono();
  app.use('/cdn/*', cdnProtection);
  app.get('/cdn/:file', (c) => {
    const contentType = c.req.query('ct') ?? 'application/octet-stream';
    return c.body('asset-data', 200, { 'Content-Type': contentType });
  });
  app.on(['HEAD', 'OPTIONS'], '/cdn/:file', (c) => c.body(null, 200));
  return app;
}

describe('cdnProtection middleware', () => {
  const app = buildApp();

  // --- Method restriction ---
  it('allows GET requests', async () => {
    const res = await app.request('/cdn/file.png');
    expect(res.status).toBe(200);
  });

  it('allows HEAD requests', async () => {
    const res = await app.request('/cdn/file.png', { method: 'HEAD' });
    expect(res.status).toBe(200);
  });

  it('allows OPTIONS requests', async () => {
    const res = await app.request('/cdn/file.png', { method: 'OPTIONS' });
    expect(res.status).toBe(200);
  });

  it('blocks POST with 405', async () => {
    const res = await app.request('/cdn/file.png', { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
  });

  it('blocks DELETE with 405', async () => {
    const res = await app.request('/cdn/file.png', { method: 'DELETE' });
    expect(res.status).toBe(405);
  });

  // --- Hotlink protection ---
  it('allows request with no Referer (direct access)', async () => {
    const res = await app.request('/cdn/file.png');
    expect(res.status).toBe(200);
  });

  it('allows request with allowed Referer (ai-grija.ro)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://ai-grija.ro/page' },
    });
    expect(res.status).toBe(200);
  });

  it('allows request with allowed Referer (www.ai-grija.ro)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://www.ai-grija.ro/' },
    });
    expect(res.status).toBe(200);
  });

  it('allows request with allowed Referer (admin.ai-grija.ro)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://admin.ai-grija.ro/dashboard' },
    });
    expect(res.status).toBe(200);
  });

  it('allows request with allowed Referer (pre.ai-grija.ro)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://pre.ai-grija.ro/' },
    });
    expect(res.status).toBe(200);
  });

  it('allows request with allowed Referer (cdn.ai-grija.ro)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://cdn.ai-grija.ro/other-asset.png' },
    });
    expect(res.status).toBe(200);
  });

  it('blocks request with foreign Referer', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://evil.com/steal' },
    });
    expect(res.status).toBe(403);
  });

  it('blocks request with foreign Referer (http variant)', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'http://competitor.ro/' },
    });
    expect(res.status).toBe(403);
  });

  it('allows Googlebot despite foreign Referer', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: {
        Referer: 'https://google.com/search',
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    expect(res.status).toBe(200);
  });

  it('allows Bingbot despite foreign Referer', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: {
        Referer: 'https://bing.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      },
    });
    expect(res.status).toBe(200);
  });

  it('allows Twitterbot despite foreign Referer', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: {
        Referer: 'https://t.co/xyz',
        'User-Agent': 'Twitterbot/1.0',
      },
    });
    expect(res.status).toBe(200);
  });

  // --- Security headers ---
  it('sets HSTS header on successful response', async () => {
    const res = await app.request('/cdn/file.png');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets X-Content-Type-Options: nosniff on successful response', async () => {
    const res = await app.request('/cdn/file.png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY for non-image content', async () => {
    const res = await app.request('/cdn/file.pdf?ct=application/pdf');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('does NOT set X-Frame-Options for image content', async () => {
    const res = await app.request('/cdn/photo.png?ct=image/png');
    expect(res.headers.get('X-Frame-Options')).toBeNull();
  });

  it('sets HSTS on 405 responses', async () => {
    const res = await app.request('/cdn/file.png', { method: 'DELETE' });
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets HSTS on 403 responses', async () => {
    const res = await app.request('/cdn/file.png', {
      headers: { Referer: 'https://evil.com/' },
    });
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });
});
