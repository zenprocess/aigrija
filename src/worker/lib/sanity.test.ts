import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanityFetch } from './sanity';
import type { Env } from './types';

const baseEnv = {
  SANITY_PROJECT_ID: 'testproj',
  SANITY_DATASET: 'production',
} as unknown as Env;

describe('sanityFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns result from Sanity response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: [{ _id: 'doc1' }] }) });
    const result = await sanityFetch(baseEnv, '*[_type == "blogPost"]');
    expect(result).toEqual([{ _id: 'doc1' }]);
  });

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(sanityFetch(baseEnv, '*')).rejects.toThrow('Sanity API error: 403');
  });

  it('builds URL with apicdn when useCdn is true', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: null }) });
    await sanityFetch(baseEnv, '*');
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('testproj.apicdn.sanity.io');
    expect(url).toContain('production');
  });

  it('appends query param to URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: null }) });
    await sanityFetch(baseEnv, '*[_type == "blogPost"]');
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('query=');
    const decoded = decodeURIComponent(url.replace(/\+/g, " ")); expect(decoded).toContain("*[_type == \"blogPost\"]");
  });

  it('appends params as $-prefixed query params', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: null }) });
    await sanityFetch(baseEnv, '*[slug.current == $slug]', { slug: 'hello' });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('%24slug');
  });

  it('uses production dataset as fallback', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: null }) });
    const env = { SANITY_PROJECT_ID: 'p', SANITY_DATASET: '' } as unknown as Env;
    await sanityFetch(env, '*');
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('/production');
  });
});
