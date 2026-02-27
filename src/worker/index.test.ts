import { describe, it, expect } from 'vitest';
import app from './index';

describe('/health', () => {
  it('returns ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; timestamp: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBe('1.0.0');
  });
});

describe('/sitemap.xml', () => {
  it('returns XML', async () => {
    const res = await app.request('/sitemap.xml', undefined, { BASE_URL: 'https://ai-grija.ro' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('ai-grija.ro');
  });
});

describe('/robots.txt', () => {
  it('returns robots', async () => {
    const res = await app.request('/robots.txt', undefined, { BASE_URL: 'https://ai-grija.ro' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Sitemap:');
  });
});

describe('/api/alerts', () => {
  it('returns campaigns list', async () => {
    const res = await app.request('/api/alerts');
    expect(res.status).toBe(200);
    const body = await res.json() as { campaigns: unknown[] };
    expect(body.campaigns.length).toBeGreaterThan(0);
  });
});
