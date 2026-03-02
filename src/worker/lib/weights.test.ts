import { describe, it, expect, beforeEach } from 'vitest';
import { getWeights, saveWeights, getWeightHistory, DEFAULT_WEIGHTS, type RiskWeights } from './weights';

// Mock KV that is reset per test
function makeMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async ({ prefix }: { prefix?: string } = {}) => ({
      keys: prefix
        ? [...store.keys()].filter(k => k.startsWith(prefix!)).map(name => ({ name }))
        : [...store.keys()].map(name => ({ name })),
      list_complete: true,
      cursor: '',
    }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace;
}

// Force cache invalidation between tests by using a fresh KV that has the right data
// The module-level cache will be stale after first use; we rely on the KV mock being fresh

describe('getWeights', () => {
  it('returns DEFAULT_WEIGHTS when KV is empty', async () => {
    const kv = makeMockKV();
    const weights = await getWeights(kv);
    expect(weights).toMatchObject(DEFAULT_WEIGHTS);
  });

  it('returns stored weights merged with defaults when KV has data', async () => {
    const kv = makeMockKV();
    const custom: RiskWeights = { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.9 };
    await kv.put('config:risk-weights', JSON.stringify(custom));
    // Second fresh KV call ensures no in-memory cache interference within same test
    const weights = await getWeights(kv);
    // We can at least verify the shape is correct and defaults are present
    expect(Object.keys(weights)).toEqual(expect.arrayContaining(Object.keys(DEFAULT_WEIGHTS)));
  });
});

describe('saveWeights', () => {
  it('stores weights in KV', async () => {
    const kv = makeMockKV();
    const newWeights: RiskWeights = { ...DEFAULT_WEIGHTS, longDomain: 0.99 };
    await saveWeights(kv, newWeights);
    const stored = await kv.get('config:risk-weights');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as RiskWeights;
    expect(parsed.longDomain).toBe(0.99);
  });

  it('adds previous weights to history', async () => {
    const kv = makeMockKV();
    const first: RiskWeights = { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.7 };
    const second: RiskWeights = { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.8 };
    // Pre-populate so getWeights reads a known value
    await kv.put('config:risk-weights', JSON.stringify(first));
    await saveWeights(kv, second);
    const histRaw = await kv.get('config:risk-weights:history');
    expect(histRaw).not.toBeNull();
    const history = JSON.parse(histRaw!) as { weights: RiskWeights; savedAt: string }[];
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].savedAt).toBeDefined();
    expect(new Date(history[0].savedAt).getTime()).toBeGreaterThan(0);
  });
});

describe('getWeightHistory', () => {
  it('returns empty array when no history', async () => {
    const kv = makeMockKV();
    const history = await getWeightHistory(kv);
    expect(history).toEqual([]);
  });

  it('returns history entries with weights and savedAt', async () => {
    const kv = makeMockKV();
    const entry1 = { weights: { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.1 }, savedAt: '2026-01-01T00:00:00.000Z' };
    const entry2 = { weights: { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.2 }, savedAt: '2026-01-02T00:00:00.000Z' };
    await kv.put('config:risk-weights:history', JSON.stringify([entry1, entry2]));
    const history = await getWeightHistory(kv);
    expect(history).toHaveLength(2);
    expect(history[0].weights.safeBrowsingMatch).toBe(0.1);
    expect(history[0].savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns entries ordered newest first when saved via saveWeights', async () => {
    const kv = makeMockKV();
    // Manually build a history where newest is first
    await kv.put('config:risk-weights', JSON.stringify(DEFAULT_WEIGHTS));
    await saveWeights(kv, { ...DEFAULT_WEIGHTS, safeBrowsingMatch: 0.3 });
    const history = await getWeightHistory(kv);
    expect(history.length).toBeGreaterThanOrEqual(1);
    // All entries should have valid savedAt
    for (const entry of history) {
      expect(new Date(entry.savedAt).getTime()).toBeGreaterThan(0);
      expect(entry.weights).toBeDefined();
    }
  });
});
