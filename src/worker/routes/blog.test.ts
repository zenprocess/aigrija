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

function makeRequest(path: string, method = 'GET', body?: string) {
  const init: RequestInit = { method };
  if (body) {
    init.body = body;
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(`https://ai-grija.ro${path}`, init);
}

vi.mock('../lib/sanity', () => ({
  sanityFetch: vi.fn(),
}));

import { sanityFetch } from '../lib/sanity';
const mockSanityFetch = vi.mocked(sanityFetch);

// ─── /amenintari ──────────────────────────────────────────────────────────────

describe('GET /amenintari', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of threat reports', async () => {
    const reports = [{ title: 'Raport 1', slug: { current: 'raport-1' } }];
    mockSanityFetch.mockResolvedValue(reports);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/amenintari'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect((json as { title: string }[])[0].title).toBe('Raport 1');
  });

  it('returns 500 on Sanity error', async () => {
    mockSanityFetch.mockRejectedValue(new Error('down'));
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/amenintari'), env);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/amenintari/i);
  });
});

describe('GET /amenintari/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single threat report', async () => {
    const report = { title: 'Raport', slug: { current: 'raport' } };
    mockSanityFetch.mockResolvedValue(report);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/amenintari/raport'), env);
    expect(res.status).toBe(200);
    const json = await res.json() as { title: string };
    expect(json.title).toBe('Raport');
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/amenintari/missing'), env);
    expect(res.status).toBe(404);
  });
});

describe('GET /amenintari/feed.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns RSS XML for amenintari', async () => {
    const posts = [{ title: 'Raport RSS', slug: { current: 'raport-rss' }, firstSeen: '2024-01-01T00:00:00Z' }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/amenintari/feed.xml'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('rss+xml');
    const text = await res.text();
    expect(text).toContain('<rss');
    expect(text).toContain('Raport RSS');
  });
});

// ─── /ghid ────────────────────────────────────────────────────────────────────

describe('GET /ghid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of guides', async () => {
    const guides = [{ title: 'Ghid 1', slug: { current: 'ghid-1' } }];
    mockSanityFetch.mockResolvedValue(guides);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/ghid'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('returns cached response on second call', async () => {
    const guides = [{ title: 'Ghid Cached', slug: { current: 'ghid-cached' } }];
    mockSanityFetch.mockResolvedValue(guides);
    const cachedBody = JSON.stringify(guides);
    const cacheStore: Record<string, string> = { 'ghid:list:ro:1': cachedBody };
    const envWithCache = makeEnv({
      CACHE: {
        get: vi.fn(async (key: string) => cacheStore[key] ?? null),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(async () => ({ keys: [] })),
      },
    });
    mockSanityFetch.mockClear();
    const res = await blog.fetch(makeRequest('/ghid'), envWithCache);
    expect(res.status).toBe(200);
    expect(mockSanityFetch).not.toHaveBeenCalled();
  });
});

describe('GET /ghid/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single guide', async () => {
    const guide = { title: 'Ghid', slug: { current: 'ghid' } };
    mockSanityFetch.mockResolvedValue(guide);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/ghid/ghid'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/ghid/missing'), env);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/gasit/i);
  });
});

describe('GET /ghid/feed.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns RSS for ghid', async () => {
    const posts = [{ title: 'Ghid RSS', slug: { current: 'ghid-rss' }, publishedAt: '2024-01-01T00:00:00Z' }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/ghid/feed.xml'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('rss+xml');
    const text = await res.text();
    expect(text).toContain('Ghid RSS');
  });
});

// ─── /educatie ────────────────────────────────────────────────────────────────

describe('GET /educatie', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of education posts', async () => {
    const posts = [{ title: 'Educatie 1', slug: { current: 'educatie-1' } }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/educatie'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /educatie/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single educatie post', async () => {
    const post = { title: 'Educatie Post', slug: { current: 'educatie-post' } };
    mockSanityFetch.mockResolvedValue(post);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/educatie/educatie-post'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/educatie/missing'), env);
    expect(res.status).toBe(404);
  });
});

describe('GET /educatie/feed.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns RSS for educatie', async () => {
    const posts = [{ title: 'Educatie RSS', slug: { current: 'edu-rss' }, publishedAt: '2024-01-01T00:00:00Z' }];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/educatie/feed.xml'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('rss+xml');
  });
});

// ─── /rapoarte ────────────────────────────────────────────────────────────────

describe('GET /rapoarte', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of weekly digests', async () => {
    const items = [{ title: 'Raport Sapt 1', slug: { current: 'raport-sapt-1' } }];
    mockSanityFetch.mockResolvedValue(items);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/rapoarte'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /rapoarte/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single raport saptamanal', async () => {
    const item = { title: 'Raport Sapt', slug: { current: 'raport-sapt' } };
    mockSanityFetch.mockResolvedValue(item);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/rapoarte/raport-sapt'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/rapoarte/missing'), env);
    expect(res.status).toBe(404);
  });
});

// ─── /povesti ─────────────────────────────────────────────────────────────────

describe('GET /povesti', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of community stories', async () => {
    const items = [{ title: 'Poveste 1', slug: { current: 'poveste-1' } }];
    mockSanityFetch.mockResolvedValue(items);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/povesti'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /povesti/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single community story', async () => {
    const item = { title: 'Poveste', slug: { current: 'poveste' } };
    mockSanityFetch.mockResolvedValue(item);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/povesti/poveste'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/povesti/missing'), env);
    expect(res.status).toBe(404);
  });
});

// ─── /presa ───────────────────────────────────────────────────────────────────

describe('GET /presa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of press releases', async () => {
    const items = [{ title: 'Comunicat 1', slug: { current: 'comunicat-1' } }];
    mockSanityFetch.mockResolvedValue(items);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/presa'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

describe('GET /presa/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single press release', async () => {
    const item = { title: 'Comunicat', slug: { current: 'comunicat' } };
    mockSanityFetch.mockResolvedValue(item);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/presa/comunicat'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockSanityFetch.mockResolvedValue(null);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/presa/missing'), env);
    expect(res.status).toBe(404);
  });
});

// ─── /feed.xml (combined) ─────────────────────────────────────────────────────

describe('GET /feed.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns combined RSS feed', async () => {
    const posts = [
      { _type: 'blogPost', category: 'ghid', title: 'Ghid RSS', slug: { current: 'g1' }, publishedAt: '2024-01-01T00:00:00Z', author: { name: 'Autor' } },
      { _type: 'threatReport', title: 'Amenintare RSS', slug: { current: 'a1' }, firstSeen: '2024-01-02T00:00:00Z' },
      { _type: 'blogPost', category: 'educatie', title: 'Educatie RSS', slug: { current: 'e1' }, publishedAt: '2024-01-03T00:00:00Z' },
    ];
    mockSanityFetch.mockResolvedValue(posts);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/feed.xml'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('rss+xml');
    const text = await res.text();
    expect(text).toContain('<rss');
    expect(text).toContain('/amenintari/a1');
    expect(text).toContain('/ghid/g1');
    expect(text).toContain('/educatie/e1');
  });
});

// ─── /sitemap-content.xml ─────────────────────────────────────────────────────

describe('GET /sitemap-content.xml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns XML sitemap with category paths', async () => {
    const result = {
      ghid: [{ slug: 'ghid-1', language: 'ro', _updatedAt: '2024-01-01T00:00:00Z' }],
      educatie: [{ slug: 'edu-1', language: 'ro', _updatedAt: '2024-01-01T00:00:00Z' }],
      amenintari: [{ slug: 'raport-1', language: 'ro', _updatedAt: '2024-01-01T00:00:00Z' }],
      rapoarte: [],
      povesti: [],
      presa: [],
    };
    mockSanityFetch.mockResolvedValue(result);
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/sitemap-content.xml'), env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('/ghid/ghid-1');
    expect(text).toContain('/educatie/edu-1');
    expect(text).toContain('/amenintari/raport-1');
  });
});

// ─── POST /content/webhook ────────────────────────────────────────────────────

describe('POST /content/webhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates cache and returns ok', async () => {
    const env = makeEnv();
    const res = await blog.fetch(makeRequest('/content/webhook', 'POST', '{}'), env);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('returns 401 when signature mismatch', async () => {
    const env = makeEnv({ SANITY_WEBHOOK_SECRET: 'secret123' });
    const req = new Request('https://ai-grija.ro/content/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'sanity-webhook-signature': 'wrong' },
    });
    const res = await blog.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
