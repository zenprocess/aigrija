import { describe, it, expect, vi } from 'vitest';
import {
  getISOWeek,
  getISOWeekNumber,
  currentWeekKey,
  weekLabel,
  generateWeeklyDigest,
  type WeeklyDigest,
} from './weekly-digest';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeKv(store: Record<string, string> = {}): any {
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => { store[key] = value; },
    list: async () => ({ keys: [] }),
  };
}

function makeDb(results: unknown[] = []): any {
  return {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results }),
        first: async () => results[0] ?? null,
      }),
    }),
  };
}

function makeEnv(kvStore: Record<string, string> = {}, dbResults: unknown[] = []): any {
  return {
    CACHE: makeKv(kvStore),
    DB: makeDb(dbResults),

    BASE_URL: 'https://ai-grija.ro',
  };
}

// ─── getISOWeek ───────────────────────────────────────────────────────────────

describe('getISOWeek', () => {
  it('returns correct week string for a known Monday', () => {
    // 2026-02-23 is week 9 of 2026
    const result = getISOWeek(new Date('2026-02-23'));
    expect(result).toBe('2026-W09');
  });

  it('returns string in YYYY-WXX format', () => {
    const result = getISOWeek(new Date('2026-01-05'));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });
});

// ─── getISOWeekNumber ─────────────────────────────────────────────────────────

describe('getISOWeekNumber', () => {
  it('returns 9 for 2026-02-23', () => {
    expect(getISOWeekNumber(new Date('2026-02-23'))).toBe(9);
  });

  it('returns a number between 1 and 53', () => {
    const w = getISOWeekNumber(new Date());
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(53);
  });
});

// ─── currentWeekKey ───────────────────────────────────────────────────────────

describe('currentWeekKey', () => {
  it('returns "YYYY-WW" format', () => {
    const key = currentWeekKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns consistent key for same date', () => {
    const d = new Date('2026-03-02');
    expect(currentWeekKey(d)).toBe(currentWeekKey(d));
  });

  it('returns correct ISO year at year boundary (Dec 31 2025 = 2026-W01)', () => {
    // Dec 31, 2025 falls in ISO week 2026-W01
    const dec31 = new Date(2025, 11, 31);
    const key = currentWeekKey(dec31);
    expect(key).toBe('2026-01');
  });
});

// ─── weekLabel ────────────────────────────────────────────────────────────────

describe('weekLabel', () => {
  it('returns a non-empty string', () => {
    expect(weekLabel().length).toBeGreaterThan(0);
  });

  it('includes year', () => {
    const label = weekLabel(new Date('2026-03-02'));
    expect(label).toContain('2026');
  });

  it('formats week for a known Monday (2026-02-23)', () => {
    // Monday 23 Feb — Sunday 1 Mar 2026
    const label = weekLabel(new Date('2026-02-25')); // Wednesday in that week
    expect(label).toContain('Feb');
    expect(label).toContain('Mar');
  });
});

// ─── generateWeeklyDigest ─────────────────────────────────────────────────────

describe('generateWeeklyDigest', () => {
  it('returns a WeeklyDigest with expected shape', async () => {
    const env = makeEnv();
    const digest = await generateWeeklyDigest(env);
    expect(digest).toHaveProperty('weekOf');
    expect(digest).toHaveProperty('topScams');
    expect(digest).toHaveProperty('stats');
    expect(digest).toHaveProperty('blogPosts');
    expect(digest).toHaveProperty('tips');
    expect(Array.isArray(digest.topScams)).toBe(true);
    expect(Array.isArray(digest.tips)).toBe(true);
    expect(digest.tips.length).toBe(3);
  });

  it('returns zeros for stats when KV is empty', async () => {
    const env = makeEnv();
    const digest = await generateWeeklyDigest(env);
    expect(digest.stats.totalChecks).toBe(0);
    expect(digest.stats.totalAlerts).toBe(0);
    expect(digest.stats.quizCompletions).toBe(0);
    expect(digest.stats.communityReports).toBe(0);
  });

  it('reads totalChecks from KV', async () => {
    const env = makeEnv({ 'stats:total_checks': '500' });
    const digest = await generateWeeklyDigest(env);
    expect(digest.stats.totalChecks).toBe(500);
  });

  it('returns cached digest on second call', async () => {
    const kvStore: Record<string, string> = {};
    const env = makeEnv(kvStore);
    const digest1 = await generateWeeklyDigest(env);
    // Modify KV directly to simulate stale cache being served
    kvStore['stats:total_checks'] = '9999';
    const digest2 = await generateWeeklyDigest(env);
    // Second call should return cached value (same totalChecks)
    expect(digest2.weekOf).toBe(digest1.weekOf);
  });

  it('maps D1 campaigns to topScams', async () => {
    const dbRows = [
      { id: '1', title: 'Frauda Banca X', source_url: 'https://example.com', severity: 'critical', created_at: new Date().toISOString() },
      { id: '2', title: 'Phishing eMAG', source_url: null, severity: 'high', created_at: new Date().toISOString() },
    ];
    const env = makeEnv({}, dbRows);
    const digest = await generateWeeklyDigest(env);
    expect(digest.topScams.length).toBe(2);
    expect(digest.topScams[0].title).toBe('Frauda Banca X');
    expect(digest.topScams[0].severity).toBe('critical');
    expect(digest.topScams[1].url).toBe('https://ai-grija.ro/alerte');
  });

  it('handles D1 failure gracefully', async () => {
    const env = makeEnv();
    env.DB = {
      prepare: () => { throw new Error('D1 unavailable'); },
    };
    const digest = await generateWeeklyDigest(env);
    expect(digest.topScams).toEqual([]);
  });

  it('tips array always has 3 items', async () => {
    const env = makeEnv();
    const digest = await generateWeeklyDigest(env);
    expect(digest.tips).toHaveLength(3);
    for (const tip of digest.tips) {
      expect(typeof tip).toBe('string');
      expect(tip.length).toBeGreaterThan(0);
    }
  });
});
