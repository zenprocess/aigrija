import type { Env } from './types';

export interface EvaluationInput {
  promptVersion: string;
  category: string;
  scores: {
    readability?: number;
    accuracy?: number;
    seo?: number;
    overall?: number;
  };
  promptText?: string;
  sampleOutput?: string;
  metadata?: Record<string, unknown>;
}

export interface GEPAEvaluation {
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

const KV_TTL_SECONDS = 3600; // 1 hour

export async function recordEvaluation(
  env: Env,
  input: EvaluationInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO gepa_evaluations
      (id, prompt_version, category, readability_score, accuracy_score, seo_score, overall_score, prompt_text, sample_output, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.promptVersion,
      input.category,
      input.scores.readability ?? null,
      input.scores.accuracy ?? null,
      input.scores.seo ?? null,
      input.scores.overall ?? null,
      input.promptText ?? null,
      input.sampleOutput ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    )
    .run();

  // Invalidate KV cache for this category when new evaluation is recorded
  await env.CACHE.delete(`gepa:best:${input.category}`);

  return id;
}

export async function getPromptHistory(
  env: Env,
  category: string,
): Promise<GEPAEvaluation[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM gepa_evaluations WHERE category = ? ORDER BY created_at DESC`,
  )
    .bind(category)
    .all<GEPAEvaluation>();

  return result.results;
}

export interface VersionComparison {
  versionA: GEPAEvaluation[];
  versionB: GEPAEvaluation[];
  avgA: { readability: number; accuracy: number; seo: number; overall: number };
  avgB: { readability: number; accuracy: number; seo: number; overall: number };
  winner: string;
}

function avgScores(evals: GEPAEvaluation[]) {
  if (evals.length === 0) return { readability: 0, accuracy: 0, seo: 0, overall: 0 };
  const sum = evals.reduce(
    (acc, e) => ({
      readability: acc.readability + (e.readability_score ?? 0),
      accuracy: acc.accuracy + (e.accuracy_score ?? 0),
      seo: acc.seo + (e.seo_score ?? 0),
      overall: acc.overall + (e.overall_score ?? 0),
    }),
    { readability: 0, accuracy: 0, seo: 0, overall: 0 },
  );
  const n = evals.length;
  return {
    readability: sum.readability / n,
    accuracy: sum.accuracy / n,
    seo: sum.seo / n,
    overall: sum.overall / n,
  };
}

export async function compareVersions(
  env: Env,
  versionA: string,
  versionB: string,
): Promise<VersionComparison> {
  const [resA, resB] = await Promise.all([
    env.DB.prepare(`SELECT * FROM gepa_evaluations WHERE prompt_version = ?`)
      .bind(versionA)
      .all<GEPAEvaluation>(),
    env.DB.prepare(`SELECT * FROM gepa_evaluations WHERE prompt_version = ?`)
      .bind(versionB)
      .all<GEPAEvaluation>(),
  ]);

  const evalsA = resA.results;
  const evalsB = resB.results;
  const avgA = avgScores(evalsA);
  const avgB = avgScores(evalsB);
  const winner = avgA.overall >= avgB.overall ? versionA : versionB;

  return { versionA: evalsA, versionB: evalsB, avgA, avgB, winner };
}

export async function getBestPrompt(
  env: Env,
  category: string,
): Promise<GEPAEvaluation | null> {
  const cacheKey = `gepa:best:${category}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GEPAEvaluation;
  }

  const result = await env.DB.prepare(
    `SELECT * FROM gepa_evaluations
     WHERE category = ? AND overall_score IS NOT NULL
     ORDER BY overall_score DESC
     LIMIT 1`,
  )
    .bind(category)
    .first<GEPAEvaluation>();

  if (result) {
    await env.CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: KV_TTL_SECONDS,
    });
  }

  return result ?? null;
}

/**
 * Returns the Pareto-optimal set of prompts for a category.
 * A prompt is Pareto-optimal if no other prompt dominates it across all three
 * objectives: readability, accuracy, and SEO.
 */
export async function getParetoFrontier(
  env: Env,
  category: string,
): Promise<GEPAEvaluation[]> {
  // Aggregate per prompt_version: average scores
  const result = await env.DB.prepare(
    `SELECT prompt_version,
            AVG(readability_score) AS readability_score,
            AVG(accuracy_score)   AS accuracy_score,
            AVG(seo_score)        AS seo_score,
            AVG(overall_score)    AS overall_score,
            MAX(id)               AS id,
            MAX(prompt_text)      AS prompt_text,
            MAX(sample_output)    AS sample_output,
            MAX(metadata)         AS metadata,
            MAX(created_at)       AS created_at
     FROM gepa_evaluations
     WHERE category = ?
       AND readability_score IS NOT NULL
       AND accuracy_score IS NOT NULL
       AND seo_score IS NOT NULL
     GROUP BY prompt_version`,
  )
    .bind(category)
    .all<GEPAEvaluation>();

  const candidates = result.results;

  // Pareto filter: keep e if no other f dominates e on all three objectives
  const pareto = candidates.filter((e) => {
    return !candidates.some(
      (f) =>
        f.prompt_version !== e.prompt_version &&
        (f.readability_score ?? 0) >= (e.readability_score ?? 0) &&
        (f.accuracy_score ?? 0) >= (e.accuracy_score ?? 0) &&
        (f.seo_score ?? 0) >= (e.seo_score ?? 0) &&
        ((f.readability_score ?? 0) > (e.readability_score ?? 0) ||
          (f.accuracy_score ?? 0) > (e.accuracy_score ?? 0) ||
          (f.seo_score ?? 0) > (e.seo_score ?? 0)),
    );
  });

  return pareto;
}
