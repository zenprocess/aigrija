import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScraper } from './scraper-runner';
import type { ScraperSource } from './scraper';
import type { Env } from './types';

const makeEnv = (overrides: Record<string, unknown> = {}): Env => ({
  CACHE: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    list: vi.fn(),
  },
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  },
  DRAFT_QUEUE: null,
  ...overrides,
} as unknown as Env);

const makeSource = (overrides: Partial<ScraperSource> = {}): ScraperSource => ({
  name: 'test-source',
  feedUrl: 'https://example.com/rss',
  type: 'rss',
  parseRSS: vi.fn().mockReturnValue([
    { title: 'Item 1', link: 'https://example.com/1', pubDate: '2026-03-01', slug: 'item-1' },
  ]),
  scrapeFullPage: vi.fn().mockResolvedValue({
    title: 'Item 1',
    slug: 'item-1',
    source: 'test-source',
    sourceUrl: 'https://example.com/1',
    publishedAt: '2026-03-01',
    bodyText: 'Some text',
    threatType: 'phishing',
    affectedBrands: ['BCR'],
    iocs: [],
    severity: 'high',
  }),
  ...overrides,
});

describe('runScraper', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns error result when RSS fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await runScraper(makeSource(), makeEnv());
    expect(result.source).toBe('test-source');
    expect(result.itemsFound).toBe(0);
    expect(result.itemsNew).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network error');
  });

  it('returns error when RSS feed returns non-ok status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    const result = await runScraper(makeSource(), makeEnv());
    expect(result.errors[0]).toContain('RSS fetch failed: 404');
  });

  it('skips already-seen items', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<rss/>' });
    const source = makeSource();
    const env = makeEnv({
      CACHE: {
        get: vi.fn().mockResolvedValue('1'),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        list: vi.fn(),
      },
    });
    const result = await runScraper(source, env);
    expect(result.itemsFound).toBe(1);
    expect(result.itemsNew).toBe(0);
    expect(source.scrapeFullPage).not.toHaveBeenCalled();
  });

  it('imports new items and marks them seen', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<rss/>' });
    const source = makeSource();
    const env = makeEnv();
    const result = await runScraper(source, env);
    expect(result.itemsFound).toBe(1);
    expect(result.itemsNew).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect((env.CACHE as { put: ReturnType<typeof vi.fn> }).put).toHaveBeenCalledWith(
      'scraper:test-source:seen:item-1',
      '1',
      { expirationTtl: 60 * 60 * 24 * 30 }
    );
  });

  it('records D1 insert error and continues', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<rss/>' });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockRejectedValue(new Error('D1 constraint')),
          }),
        }),
      },
    });
    const result = await runScraper(makeSource(), env);
    expect(result.errors.some((e) => e.includes('D1 insert error'))).toBe(true);
    expect(result.itemsNew).toBe(0);
  });

  it('records scrape error and continues', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<rss/>' });
    const source = makeSource({
      scrapeFullPage: vi.fn().mockRejectedValue(new Error('parse failed')),
    });
    const result = await runScraper(source, makeEnv());
    expect(result.errors.some((e) => e.includes('Scrape error'))).toBe(true);
    expect(result.itemsNew).toBe(0);
  });

  it('enqueues to DRAFT_QUEUE when available', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<rss/>' });
    const queueSend = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({ DRAFT_QUEUE: { send: queueSend } });
    await runScraper(makeSource(), env);
    expect(queueSend).toHaveBeenCalledOnce();
  });
});
