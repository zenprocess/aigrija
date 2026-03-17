import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { newsletterAdmin, fetchButtondownSubscribers, BUTTONDOWN_API_BASE } from './newsletter';

// ---- Helpers ---------------------------------------------------------------

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeKV() {
  return { delete: vi.fn(async () => undefined), get: vi.fn(), put: vi.fn() };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    BUTTONDOWN_API_KEY: 'test-key',
    CACHE: makeKV(),
    ...overrides,
  };
}

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[call] ?? responses[responses.length - 1];
    call++;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      statusText: r.ok ? 'OK' : 'Error',
      json: async () => r.body,
    };
  });
}

const sampleSubscribers = [
  { id: 'sub-1', email: 'ion@test.ro', creation_date: '2025-01-15T00:00:00Z', subscriber_type: 'regular', tags: ['digest'], metadata: {} },
  { id: 'sub-2', email: 'maria@test.ro', creation_date: '2025-02-20T00:00:00Z', subscriber_type: 'regular', tags: [], metadata: {} },
];

// ---- Tests -----------------------------------------------------------------

describe('fetchButtondownSubscribers — URL construction', () => {
  it('builds URL with URLSearchParams, not string concatenation', async () => {
    const capturedUrls: string[] = [];
    const mockFetchFn = vi.fn(async (url: string | URL) => {
      capturedUrls.push(url instanceof URL ? url.toString() : url);
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ results: [], count: 0, next: null, previous: null }) };
    });
    globalThis.fetch = mockFetchFn as unknown as typeof fetch;

    await fetchButtondownSubscribers('test-key', 3);

    expect(capturedUrls).toHaveLength(1);
    const parsed = new URL(capturedUrls[0]);
    expect(parsed.origin + parsed.pathname).toBe(`${BUTTONDOWN_API_BASE}/subscribers`);
    expect(parsed.searchParams.get('page')).toBe('3');
    // Ensure no raw template literal injection possible (no extra query chars)
    expect(parsed.searchParams.toString()).toBe('page=3');
  });
});

describe('newsletterAdmin', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET / — subscriber list', () => {
    it('returns HTML with subscriber table on success', async () => {
      globalThis.fetch = mockFetch([{
        ok: true,
        body: { results: sampleSubscribers, count: 2, next: null, previous: null },
      }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('ion@test.ro');
      expect(html).toContain('maria@test.ro');
      expect(html).toContain('Newsletter Subscribers (2)');
    });

    it('returns 500 when BUTTONDOWN_API_KEY is missing', async () => {
      const req = new Request('http://localhost/');
      const res = await newsletterAdmin.fetch(req, makeEnv({ BUTTONDOWN_API_KEY: undefined }), makeCtx());
      expect(res.status).toBe(500);
      const html = await res.text();
      expect(html).toContain('BUTTONDOWN_API_KEY missing');
    });

    it('returns 502 when Buttondown API fails', async () => {
      globalThis.fetch = mockFetch([{ ok: false, status: 503 }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(502);
      const html = await res.text();
      expect(html).toContain('Buttondown API Error');
    });

    it('renders pagination when multiple pages exist', async () => {
      const manySubscribers = Array.from({ length: 50 }, (_, i) => ({
        id: `sub-${i}`,
        email: `user${i}@test.ro`,
        creation_date: '2025-01-01T00:00:00Z',
        subscriber_type: 'regular',
        tags: [],
        metadata: {},
      }));
      globalThis.fetch = mockFetch([{
        ok: true,
        body: { results: manySubscribers, count: 120, next: 'page2', previous: null },
      }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/?page=1');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      const html = await res.text();
      // 120 / 50 = 3 pages
      expect(html).toContain('?page=3');
    });

    it('shows empty state when no subscribers', async () => {
      globalThis.fetch = mockFetch([{
        ok: true,
        body: { results: [], count: 0, next: null, previous: null },
      }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      const html = await res.text();
      expect(html).toContain('No subscribers');
    });
  });

  describe('GET /export — CSV download', () => {
    it('returns CSV with correct headers', async () => {
      globalThis.fetch = mockFetch([{
        ok: true,
        body: { results: sampleSubscribers, count: 2, next: null, previous: null },
      }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/export');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      const text = await res.text();
      expect(text).toContain('email,subscriber_type,creation_date,tags');
      expect(text).toContain('ion@test.ro');
      expect(text).toContain('maria@test.ro');
      expect(text).toContain('digest');
    });

    it('paginates through all subscribers', async () => {
      const page1Subs = Array.from({ length: 50 }, (_, i) => ({
        id: `sub-${i}`, email: `p1user${i}@test.ro`, creation_date: '2025-01-01T00:00:00Z',
        subscriber_type: 'regular', tags: [], metadata: {},
      }));
      const page2Subs = [{ id: 'sub-last', email: 'last@test.ro', creation_date: '2025-01-01T00:00:00Z', subscriber_type: 'regular', tags: [], metadata: {} }];

      globalThis.fetch = mockFetch([
        { ok: true, body: { results: page1Subs, count: 51, next: 'page2', previous: null } },
        { ok: true, body: { results: page2Subs, count: 51, next: null, previous: 'page1' } },
      ]) as unknown as typeof fetch;

      const req = new Request('http://localhost/export');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      const text = await res.text();
      expect(text).toContain('last@test.ro');
    });

    it('returns 500 when BUTTONDOWN_API_KEY is missing', async () => {
      const req = new Request('http://localhost/export');
      const res = await newsletterAdmin.fetch(req, makeEnv({ BUTTONDOWN_API_KEY: undefined }), makeCtx());
      expect(res.status).toBe(500);
    });

    it('returns 502 when Buttondown API fails during export', async () => {
      globalThis.fetch = mockFetch([{ ok: false, status: 500 }]) as unknown as typeof fetch;

      const req = new Request('http://localhost/export');
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(502);
    });
  });

  describe('DELETE /:email — remove subscriber', () => {
    it('deletes subscriber and purges KV consent', async () => {
      // mock: lookup returns subscriber, delete returns 204
      globalThis.fetch = mockFetch([
        { ok: true, body: { results: [sampleSubscribers[0]], count: 1, next: null, previous: null } },
        { ok: true, status: 204, body: null },
      ]) as unknown as typeof fetch;

      const env = makeEnv();
      const req = new Request('http://localhost/ion%40test.ro', { method: 'DELETE' });
      const res = await newsletterAdmin.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toBe('');
      expect((env.CACHE as ReturnType<typeof makeKV>).delete).toHaveBeenCalledWith('consent:email:ion@test.ro');
    });

    it('returns 500 when BUTTONDOWN_API_KEY is missing', async () => {
      const req = new Request('http://localhost/ion%40test.ro', { method: 'DELETE' });
      const res = await newsletterAdmin.fetch(req, makeEnv({ BUTTONDOWN_API_KEY: undefined }), makeCtx());
      expect(res.status).toBe(500);
    });

    it('returns 502 when subscriber not found in Buttondown', async () => {
      globalThis.fetch = mockFetch([
        { ok: true, body: { results: [], count: 0, next: null, previous: null } },
      ]) as unknown as typeof fetch;

      const req = new Request('http://localhost/ghost%40test.ro', { method: 'DELETE' });
      const res = await newsletterAdmin.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(502);
      const html = await res.text();
      expect(html).toContain('Buttondown Error');
    });

    it('still succeeds if KV delete fails (non-fatal)', async () => {
      globalThis.fetch = mockFetch([
        { ok: true, body: { results: [sampleSubscribers[0]], count: 1, next: null, previous: null } },
        { ok: true, status: 204, body: null },
      ]) as unknown as typeof fetch;

      const env = makeEnv();
      (env.CACHE as ReturnType<typeof makeKV>).delete.mockRejectedValue(new Error('KV timeout'));

      const req = new Request('http://localhost/ion%40test.ro', { method: 'DELETE' });
      const res = await newsletterAdmin.fetch(req, env, makeCtx());
      // Should still return 200 (non-fatal KV error)
      expect(res.status).toBe(200);
    });
  });
});
