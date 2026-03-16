import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchCampaignsFromDB } from './campaign-matcher';

function makeKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

function makeDB(rows: Record<string, unknown>[] = []): D1Database {
  return {
    prepare: vi.fn(() => ({
      all: vi.fn(async () => ({ results: rows, success: true })),
    })),
    batch: vi.fn(),
    dump: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

const sampleRow = {
  id: 'abc123',
  slug: 'ing-spoofing-dnsc',
  title: 'Alerta spoofing ING Bank Romania',
  body_text: 'Campanie de spoofing prin care atacatorii imita ING Romania pentru a fura date homebank',
  affected_brands: '["ING Bank","ING Romania"]',
};

describe('matchCampaignsFromDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when D1 has no rows', async () => {
    const db = makeDB([]);
    const cache = makeKV();
    const result = await matchCampaignsFromDB('some text', undefined, db, cache);
    expect(result).toEqual([]);
  });

  it('matches a campaign by keyword in text', async () => {
    const db = makeDB([sampleRow]);
    const cache = makeKV();
    const result = await matchCampaignsFromDB('Am primit un apel fals de la ING Bank', undefined, db, cache);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].campaign_id).toBe('abc123');
    expect(result[0].slug).toBe('ing-spoofing-dnsc');
    expect(result[0].score).toBeGreaterThan(0);
  });

  it('scores URL brand match higher than text keyword match', async () => {
    // Use a row with a single-word brand so URL substring matching works
    const rowForUrlTest = {
      id: 'abc123',
      slug: 'ing-spoofing-dnsc',
      title: 'Alerta spoofing homebank Romania',
      body_text: null,
      affected_brands: '["ingbank"]',
    };
    const db = makeDB([rowForUrlTest]);
    const cache = makeKV();
    // 'homebank' is a keyword (>3 chars) from title — text-only match → score 1
    const resultNoUrl = await matchCampaignsFromDB('homebank', undefined, db, cache);
    // same text + URL containing brand 'ingbank' → text score 1 + url score 2 = 3
    const resultWithUrl = await matchCampaignsFromDB('homebank', 'https://ingbank.fake.ro/login', db, cache);
    expect(resultNoUrl.length).toBeGreaterThan(0);
    expect(resultWithUrl[0].score).toBeGreaterThan(resultNoUrl[0].score);
  });

  it('returns empty when text does not match any keyword', async () => {
    const db = makeDB([sampleRow]);
    const cache = makeKV();
    const result = await matchCampaignsFromDB('complet irelevant', undefined, db, cache);
    expect(result).toEqual([]);
  });

  it('uses KV cache on second call, skipping D1', async () => {
    const db = makeDB([sampleRow]);
    const cache = makeKV();
    // First call — populates cache
    await matchCampaignsFromDB('ING Bank', undefined, db, cache);
    // Second call — should hit cache, not D1
    await matchCampaignsFromDB('ING Bank', undefined, db, cache);
    const prepareSpy = db.prepare as ReturnType<typeof vi.fn>;
    expect(prepareSpy).toHaveBeenCalledTimes(1);
  });

  it('gracefully returns empty array when D1 throws', async () => {
    const db = {
      prepare: vi.fn(() => ({ all: vi.fn(async () => { throw new Error('D1 unavailable'); }) })),
    } as unknown as D1Database;
    const cache = makeKV();
    const result = await matchCampaignsFromDB('ING Bank', undefined, db, cache);
    expect(result).toEqual([]);
  });

  it('handles malformed affected_brands JSON without throwing', async () => {
    const db = makeDB([{ ...sampleRow, affected_brands: 'not-json' }]);
    const cache = makeKV();
    const result = await matchCampaignsFromDB('ING', undefined, db, cache);
    // Should not throw; may or may not match based on title keywords
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns results sorted by score descending', async () => {
    const row2 = {
      id: 'def456',
      slug: 'fanbox-dnsc',
      title: 'Phishing FAN Courier colet confirmare livrare',
      body_text: 'SMS fals de la FAN Courier',
      affected_brands: '["FAN Courier"]',
    };
    const db = makeDB([sampleRow, row2]);
    const cache = makeKV();
    // Text hits ING multiple times → higher score for ING campaign
    const result = await matchCampaignsFromDB('ING Bank ING Romania spoofing ING', undefined, db, cache);
    if (result.length > 1) {
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    }
    expect(result.length).toBeGreaterThan(0);
  });
});
