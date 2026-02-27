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
  it('returns XML with campaign URLs', async () => {
    const res = await app.request('/sitemap.xml', undefined, { BASE_URL: 'https://ai-grija.ro' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('ai-grija.ro');
    expect(text).toContain('apel-fals-ing-romania-2025');
  });
});

describe('/robots.txt', () => {
  it('returns robots with sitemap', async () => {
    const res = await app.request('/robots.txt', undefined, { BASE_URL: 'https://ai-grija.ro' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Sitemap: https://ai-grija.ro/sitemap.xml');
  });
});

describe('/api/alerts', () => {
  it('returns all campaigns', async () => {
    const res = await app.request('/api/alerts');
    expect(res.status).toBe(200);
    const body = await res.json() as { campaigns: { id: string }[] };
    expect(body.campaigns.length).toBe(6);
  });

  it('filters by status', async () => {
    const res = await app.request('/api/alerts?status=active');
    expect(res.status).toBe(200);
    const body = await res.json() as { campaigns: { status: string }[] };
    expect(body.campaigns.every(c => c.status === 'active')).toBe(true);
  });

  it('rejects invalid status', async () => {
    const res = await app.request('/api/alerts?status=bogus');
    expect(res.status).toBe(400);
  });
});

describe('/alerte/:slug', () => {
  it('returns 404 for unknown slug', async () => {
    const env = { BASE_URL: 'https://ai-grija.ro', CACHE: mockKV() };
    const res = await app.request('/alerte/nonexistent-slug', undefined, env);
    expect(res.status).toBe(404);
  });
});

describe('/webhook/whatsapp GET', () => {
  it('returns challenge on valid verify token', async () => {
    const env = { WHATSAPP_VERIFY_TOKEN: 'test-token' };
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=CHALLENGE_123',
      undefined, env
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('CHALLENGE_123');
  });

  it('returns 403 on wrong verify token', async () => {
    const env = { WHATSAPP_VERIFY_TOKEN: 'test-token' };
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=X',
      undefined, env
    );
    expect(res.status).toBe(403);
  });
});

describe('/webhook/telegram POST', () => {
  it('returns 401 without secret header', async () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: 'secret123' };
    const res = await app.request('/webhook/telegram', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });
});

// Minimal KV mock for routes that need CACHE
function mockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}
