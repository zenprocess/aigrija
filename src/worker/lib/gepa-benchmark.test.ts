import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordEvaluation,
  getPromptHistory,
  compareVersions,
  getBestPrompt,
  getParetoFrontier,
  type GEPAEvaluation,
} from './gepa-benchmark';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------
interface Row {
  id: string;
  prompt_version: string;
  category: string;
  readability_score: number | null;
  accuracy_score: number | null;
  seo_score: number | null;
  overall_score: number | null;
  prompt_text: string | null;
  sample_output: string | null;
  metadata: string | null;
  created_at: string;
}

function makeD1(rows: Row[] = []) {
  const store: Row[] = [...rows];

  const makeStatement = (sql: string, bindings: unknown[]) => {
    return {
      run: async () => {
        // INSERT INTO gepa_evaluations ...
        if (sql.trimStart().toUpperCase().startsWith('INSERT')) {
          const [id, prompt_version, category, readability_score, accuracy_score, seo_score, overall_score, prompt_text, sample_output, metadata] = bindings as [string, string, string, number | null, number | null, number | null, number | null, string | null, string | null, string | null];
          store.push({
            id,
            prompt_version,
            category,
            readability_score,
            accuracy_score,
            seo_score,
            overall_score,
            prompt_text,
            sample_output,
            metadata,
            created_at: new Date().toISOString(),
          });
        }
        return { success: true };
      },
      all: async <T>() => {
        let results: Row[] = store;

        // Simple WHERE category = ? filter
        if (sql.includes('WHERE category = ?') && !sql.includes('GROUP BY')) {
          results = results.filter((r) => r.category === bindings[0]);
        }
        // WHERE prompt_version = ?
        if (sql.includes('WHERE prompt_version = ?')) {
          results = results.filter((r) => r.prompt_version === bindings[0]);
        }
        // GROUP BY prompt_version with multi-objective filter
        if (sql.includes('GROUP BY prompt_version') && sql.includes('WHERE category = ?')) {
          const cat = bindings[0] as string;
          const filtered = results.filter(
            (r) =>
              r.category === cat &&
              r.readability_score !== null &&
              r.accuracy_score !== null &&
              r.seo_score !== null,
          );
          // aggregate per prompt_version
          const map = new Map<string, Row>();
          for (const r of filtered) {
            if (!map.has(r.prompt_version)) {
              map.set(r.prompt_version, { ...r });
            } else {
              const existing = map.get(r.prompt_version)!;
              existing.readability_score = ((existing.readability_score ?? 0) + (r.readability_score ?? 0)) / 2;
              existing.accuracy_score = ((existing.accuracy_score ?? 0) + (r.accuracy_score ?? 0)) / 2;
              existing.seo_score = ((existing.seo_score ?? 0) + (r.seo_score ?? 0)) / 2;
              existing.overall_score = ((existing.overall_score ?? 0) + (r.overall_score ?? 0)) / 2;
            }
          }
          return { results: Array.from(map.values()) as unknown as T[] };
        }

        return { results: results as unknown as T[] };
      },
      first: async <T>() => {
        let results: Row[] = store;
        if (sql.includes('WHERE category = ?')) {
          results = results.filter(
            (r) => r.category === bindings[0] && r.overall_score !== null,
          );
          results.sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));
        }
        return (results[0] as unknown as T) ?? null;
      },
      bind: (...args: unknown[]) => makeStatement(sql, args),
    };
  };

  return {
    prepare: (sql: string) => makeStatement(sql, []),
    _store: store,
  };
}

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    _store: store,
  };
}

function makeEnv(rows: Row[] = []) {
  return {
    DB: makeD1(rows),
    CACHE: makeKV(),
  } as unknown as import('./types').Env;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gepa-benchmark service', () => {
  it('recordEvaluation inserts a row and returns an id', async () => {
    const env = makeEnv();
    const id = await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'alert',
      scores: { readability: 0.8, accuracy: 0.9, seo: 0.7, overall: 0.8 },
      promptText: 'test prompt',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('getPromptHistory returns evaluations for a category', async () => {
    const env = makeEnv();
    await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'alert',
      scores: { readability: 0.8, accuracy: 0.9, seo: 0.7, overall: 0.8 },
    });
    await recordEvaluation(env, {
      promptVersion: 'v2',
      category: 'alert',
      scores: { readability: 0.85, accuracy: 0.88, seo: 0.75, overall: 0.83 },
    });
    await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'guide',
      scores: { overall: 0.6 },
    });

    const history = await getPromptHistory(env, 'alert');
    expect(history.length).toBe(2);
    expect(history.every((e) => e.category === 'alert')).toBe(true);
  });

  it('compareVersions returns averages and correct winner', async () => {
    const env = makeEnv();
    await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'alert',
      scores: { readability: 0.7, accuracy: 0.7, seo: 0.7, overall: 0.7 },
    });
    await recordEvaluation(env, {
      promptVersion: 'v2',
      category: 'alert',
      scores: { readability: 0.9, accuracy: 0.9, seo: 0.9, overall: 0.9 },
    });

    const comparison = await compareVersions(env, 'v1', 'v2');
    expect(comparison.winner).toBe('v2');
    expect(comparison.avgA.overall).toBeCloseTo(0.7, 2);
    expect(comparison.avgB.overall).toBeCloseTo(0.9, 2);
  });

  it('getBestPrompt returns highest overall_score and caches result', async () => {
    const env = makeEnv();
    await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'alert',
      scores: { overall: 0.7 },
    });
    await recordEvaluation(env, {
      promptVersion: 'v2',
      category: 'alert',
      scores: { overall: 0.95 },
    });

    const best = await getBestPrompt(env, 'alert');
    expect(best).not.toBeNull();
    expect(best!.overall_score).toBeCloseTo(0.95, 2);

    // Second call should use KV cache
    const kvStore = (env.CACHE as ReturnType<typeof makeKV>)._store;
    expect(kvStore.has('gepa:best:alert')).toBe(true);
    const cached = await getBestPrompt(env, 'alert');
    expect(cached!.overall_score).toBeCloseTo(0.95, 2);
  });

  it('getBestPrompt returns null for unknown category', async () => {
    const env = makeEnv();
    const best = await getBestPrompt(env, 'unknown-cat');
    expect(best).toBeNull();
  });

  it('recordEvaluation invalidates KV cache', async () => {
    const env = makeEnv();
    // Warm the cache
    const kvStore = (env.CACHE as ReturnType<typeof makeKV>)._store;
    kvStore.set('gepa:best:alert', JSON.stringify({ id: 'old', overall_score: 0.5 }));

    await recordEvaluation(env, {
      promptVersion: 'v3',
      category: 'alert',
      scores: { overall: 0.99 },
    });

    expect(kvStore.has('gepa:best:alert')).toBe(false);
  });

  it('getParetoFrontier returns only non-dominated prompts', async () => {
    const env = makeEnv();
    // v1: balanced
    await recordEvaluation(env, {
      promptVersion: 'v1',
      category: 'alert',
      scores: { readability: 0.8, accuracy: 0.8, seo: 0.8, overall: 0.8 },
    });
    // v2: dominates v1 on all axes
    await recordEvaluation(env, {
      promptVersion: 'v2',
      category: 'alert',
      scores: { readability: 0.9, accuracy: 0.9, seo: 0.9, overall: 0.9 },
    });
    // v3: dominated by v2
    await recordEvaluation(env, {
      promptVersion: 'v3',
      category: 'alert',
      scores: { readability: 0.5, accuracy: 0.5, seo: 0.5, overall: 0.5 },
    });

    const pareto = await getParetoFrontier(env, 'alert');
    const versions = pareto.map((e) => e.prompt_version);
    // v2 dominates v1 and v3 — only v2 is on the frontier
    expect(versions).toContain('v2');
    expect(versions).not.toContain('v3');
  });
});
