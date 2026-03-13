/**
 * Integration tests for blog routes in test environment.
 * Does NOT mock sanityFetch — relies on ENVIRONMENT=test to activate mock data.
 */
import { describe, it, expect, vi } from 'vitest';
import { blog } from './blog';

function makeTestEnv(overrides: Record<string, unknown> = {}) {
  const store: Record<string, string> = {};
  return {
    BASE_URL: 'https://ai-grija.ro',
    SANITY_PROJECT_ID: 'testproject',
    SANITY_DATASET: 'production',
    SANITY_WEBHOOK_SECRET: '',
    ENVIRONMENT: 'test',
    CACHE: {
      get: vi.fn(async (key: string) => store[key] ?? null),
      put: vi.fn(async (key: string, value: string) => { store[key] = value; }),
      delete: vi.fn(async (key: string) => { delete store[key]; }),
      list: vi.fn(async () => ({ keys: [] as { name: string }[] })),
    },
    ...overrides,
  };
}

function makeRequest(path: string, method = 'GET') {
  return new Request(`https://ai-grija.ro${path}`, { method });
}

// ─── /ghid ─────────────────────────────────────────────────────────────────

describe('blog routes in ENVIRONMENT=test', () => {
  describe('GET /ghid', () => {
    it('returns 200 with Romanian mock data', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/ghid'), env);
      expect(res.status).toBe(200);
      const json = await res.json() as unknown[];
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);
    });

    it('returns posts with required fields', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/ghid'), env);
      const json = await res.json() as Array<{ title: string; slug: { current: string } }>;
      const post = json[0];
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('slug');
    });

    it('returns 200 for existing slug', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/ghid/cum-sa-te-protejezi-de-phishing'), env);
      expect(res.status).toBe(200);
    });

    it('returns 404 for unknown slug', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/ghid/nonexistent-slug-xyz-abc'), env);
      expect(res.status).toBe(404);
    });
  });

  // ─── /educatie ─────────────────────────────────────────────────────────────

  describe('GET /educatie', () => {
    it('returns 200 with Romanian mock data', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/educatie'), env);
      expect(res.status).toBe(200);
      const json = await res.json() as unknown[];
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);
    });

    it('returns 200 for existing educatie slug', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/educatie/securitatea-digitala-pentru-copii'), env);
      expect(res.status).toBe(200);
    });
  });

  // ─── /amenintari ───────────────────────────────────────────────────────────

  describe('GET /amenintari', () => {
    it('returns 200 with mock threat data', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/amenintari'), env);
      expect(res.status).toBe(200);
      const json = await res.json() as unknown[];
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);
    });
  });

  // ─── RSS feeds ─────────────────────────────────────────────────────────────

  describe('GET /ghid/feed.xml', () => {
    it('returns 200 RSS feed', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/ghid/feed.xml'), env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('xml');
    });
  });

  describe('GET /educatie/feed.xml', () => {
    it('returns 200 RSS feed', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/educatie/feed.xml'), env);
      expect(res.status).toBe(200);
    });
  });

  // ─── Combined feed ─────────────────────────────────────────────────────────

  describe('GET /feed.xml', () => {
    it('returns combined RSS feed with mock data', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/feed.xml'), env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('xml');
    });
  });

  // ─── Sitemap ───────────────────────────────────────────────────────────────

  describe('GET /sitemap-content.xml', () => {
    it('returns sitemap with all categories', async () => {
      const env = makeTestEnv();
      const res = await blog.fetch(makeRequest('/sitemap-content.xml'), env);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('ghid');
      expect(text).toContain('educatie');
    });
  });
});
