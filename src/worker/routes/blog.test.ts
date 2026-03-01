import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blog } from './blog';

// ─── Mock env ─────────────────────────────────────────────────────────────────

function makeEnv(overrides: Record<string, unknown> = {}) {
  const store: Record<string, string> = {};
  return {
    BASE_URL: 'https://ai-grija.ro',
    SANITY_PROJECT_ID: 'testproject',
    SANITY_DATASET: 'production',
    SANITY_WEBHOOK_SECRET: '',
    CACHE: {
      get: vi.fn(async (key: string) => store[key] ?? null),
      put: vi.fn(async (key: string, value: string) => { store[key] = value; }),
      delete: vi.fn(async (key: string) => { delete store[key]; }),
      list: vi.fn(async () => ({ keys: [] as { name: string }[] })),
    },
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path: string, method = 'GET', body?: string) {
  const init: RequestInit = { method };
  if (body) {
    init.body = body;
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(`https://ai-grija.ro${path}`, init);
}

// ─── sanityFetch mock ─────────────────────────────────────────────────────────

vi.mock('../lib/sanity', () => ({
  sanityFetch: vi.fn(),
}));

import { sanityFetch } from '../lib/sanity';
const mockSanityFetch = vi.mocked(sanityFetch);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /blog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of posts as JSON', async () => {
    const posts = [{ title: 'Test', slug: { current: 'test' } }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].title).toBe('Test');
  });

  it('returns cached response on second call', async () => {
    const posts = [{ title: 'Cached', slug: { current: 'cached' } }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    // First call populates cache
    await blog.fetch(makeRequest('/blog'), env);
    // Pre-seed cache manually (simulating KV returning stored value)
    const cachedBody = JSON.stringify(posts);
    const cacheStore: Record<string, string> = { 'blog:list:ro:1': cachedBody };
    const envWithCache = makeEnv({
      CACHE: {
        get: vi.fn(async (key: string) => cacheStore[key] ?? null),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(async () => ({ keys: [] })),
      },
    });
    mockSanityFetch.mockClear();
    const res2 = await blog.fetch(makeRequest('/blog'), envWithCache);
    expect(res2.status).toBe(200);
    // sanityFetch should NOT have been called again
    expect(mockSanityFetch).not.toHaveBeenCalled();
  });

  it('returns 500 on Sanity error', async () => {
    mockSanityFetch.mockRejectedValue(new Error('Sanity down'));
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog'), env);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/articolele/i);
  });
});

describe('GET /blog/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single post', async () => {
    const post = { title: 'Articol', slug: { current: 'articol' }, body: [] };
    mockSanityFetch.mockResolvedValue(post);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog/articol'), env);
    expect(res.status).toBe(200);
    const json = await res.json() as { title: string };
    expect(json.title).toBe('Articol');
  });

  it('returns 404 when post not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog/inexistent'), env);
    expect(res.status).toBe(404);
  });
});

describe('GET /blog/feed.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid RSS XML', async () => {
    const posts = [
      { title: 'Post 1', slug: { current: 'post-1' }, excerpt: 'Text', publishedAt: '2024-01-01T00:00:00Z', author: { name: 'Autor' } },
    ];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog/feed.xml'), env);
    expect(res.status).toBe(200);
    const ct = res.headers.get('Content-Type');
    expect(ct).toContain('rss+xml');
    const text = await res.text();
    expect(text).toContain('<rss');
    expect(text).toContain('Post 1');
  });
});

describe('GET /sitemap-content.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns XML sitemap', async () => {
    const result = {
      blogPosts: [{ slug: 'post-1', language: 'ro', _updatedAt: '2024-01-01T00:00:00Z' }],
      threatReports: [],
      bankGuides: [],
    };
    mockSanityFetch.mockResolvedValue(result);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/sitemap-content.xml'), env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('/blog/post-1');
  });
});

describe('POST /blog/webhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates cache and returns ok', async () => {
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/blog/webhook', 'POST', '{}'), env);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('returns 401 when signature mismatch', async () => {
    const env = makeEnv({ SANITY_WEBHOOK_SECRET: 'secret123' });
    const req = new Request('https://ai-grija.ro/blog/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'sanity-webhook-signature': 'wrong' },
    });
    const res = await blog.fetch(req, env);
    expect(res.status).toBe(401);
  });
});

describe('GET /reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of threat reports', async () => {
    const reports = [{ title: 'Raport 1', slug: { current: 'raport-1' } }];
    mockSanityFetch.mockResolvedValue(reports);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/reports'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /reports/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single report', async () => {
    const report = { title: 'Raport', slug: { current: 'raport' } };
    mockSanityFetch.mockResolvedValue(report);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/reports/raport'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing report', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/reports/missing'), env);
    expect(res.status).toBe(404);
  });
});

describe('GET /guides', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of bank guides', async () => {
    const guides = [{ title: 'Ghid 1', slug: { current: 'ghid-1' } }];
    mockSanityFetch.mockResolvedValue(guides);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/guides'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /guides/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single guide', async () => {
    const guide = { title: 'Ghid', slug: { current: 'ghid' } };
    mockSanityFetch.mockResolvedValue(guide);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/guides/ghid'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing guide', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/guides/missing'), env);
    expect(res.status).toBe(404);
  });
});
