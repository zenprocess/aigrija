import { describe, it, expect } from 'vitest';
import { app } from './index';

describe('/health', () => {
  it('returns ok status with deep checks', async () => {
    const env = {
      CACHE: mockKV(),
      AI: {},
      STORAGE: mockR2(),
      DB: mockD1(),
      DRAFT_QUEUE: mockQueue(),
    };
    const res = await app.request('/health', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
    expect(body.components.kv.status).toBe('healthy');
    expect(body.components.ai.status).toBe('healthy');
    expect(body.components.r2.status).toBe('healthy');
    expect(body.components.d1.status).toBe('healthy');
    expect(body.components.queue.status).toBe('healthy');
  });

  it('returns X-Request-Id header', async () => {
    const env = { CACHE: mockKV(), AI: {}, STORAGE: mockR2(), DB: mockD1(), DRAFT_QUEUE: mockQueue() };
    const res = await app.request('/health', undefined, env);
    expect(res.headers.get('X-Request-Id')).toBeDefined();
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

  it('rejects invalid status with error envelope', async () => {
    const res = await app.request('/api/alerts?status=bogus');
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.request_id).toBeDefined();
  });
});

describe('secureHeaders global middleware', () => {
  it('returns X-Content-Type-Options on /health', async () => {
    const env = { CACHE: mockKV(), AI: {}, STORAGE: mockR2(), DB: mockD1(), DRAFT_QUEUE: mockQueue() };
    const res = await app.request('/health', undefined, env);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('returns X-Frame-Options on /health', async () => {
    const env = { CACHE: mockKV(), AI: {}, STORAGE: mockR2(), DB: mockD1(), DRAFT_QUEUE: mockQueue() };
    const res = await app.request('/health', undefined, env);
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('returns X-Content-Type-Options on /api/alerts', async () => {
    const res = await app.request('/api/alerts');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('returns X-Frame-Options on /api/alerts', async () => {
    const res = await app.request('/api/alerts');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});

describe('/alerte/:slug', () => {
  it('returns 404 with error envelope for unknown slug', async () => {
    const env = { BASE_URL: 'https://ai-grija.ro', CACHE: mockKV() };
    const res = await app.request('/alerte/nonexistent-slug', undefined, env);
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.request_id).toBeDefined();
  });
});

describe('/favicon.ico', () => {
  it('returns 200 with image/x-icon content-type', async () => {
    const res = await app.request('/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/x-icon');
  });

  it('returns non-empty body', async () => {
    const res = await app.request('/favicon.ico');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
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
  it('returns 401 with error envelope without secret header', async () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: 'secret123' };
    const res = await app.request('/webhook/telegram', { method: 'POST' }, env);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.request_id).toBeDefined();
  });
});

// Minimal KV mock
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

// Minimal R2 mock
function mockR2(): R2Bucket {
  return {
    head: async () => null,
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false }),
    createMultipartUpload: async () => ({}),
    resumeMultipartUpload: async () => ({}),
  } as unknown as R2Bucket;
}

function mockD1(): D1Database {
  return {
    prepare: () => ({
      first: async () => ({ 1: 1 }),
      run: async () => ({}),
      all: async () => ({ results: [] }),
      raw: async () => [],
      bind: () => ({}),
    }),
    exec: async () => ({}),
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function mockQueue(): Queue {
  return { send: async () => {}, sendBatch: async () => {} } as unknown as Queue;
}
