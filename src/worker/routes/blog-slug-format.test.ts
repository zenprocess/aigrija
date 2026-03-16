/**
 * Regression tests for S-426: [object Object] in content URLs
 *
 * Sanity stores slugs as { _type: "slug", current: "actual-string" }.
 * The GROQ queries MUST project "slug": slug.current to return strings.
 * If bare `slug` is projected, item.slug becomes an object and
 * JavaScript coerces it to "[object Object]" in URL construction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const blogSource = readFileSync(join(process.cwd(), 'src/worker/routes/blog.ts'), 'utf-8');

// ─── GROQ query correctness ────────────────────────────────────────────────────

describe('GROQ slug dereferencing — query strings', () => {
  it('GHID_LIST_QUERY projects "slug": slug.current (not bare slug)', () => {
    const match = blogSource.match(/const GHID_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('EDUCATIE_LIST_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const EDUCATIE_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('AMENINTARI_LIST_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const AMENINTARI_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('RAPOARTE_LIST_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const RAPOARTE_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('POVESTI_LIST_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const POVESTI_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('PRESA_LIST_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const PRESA_LIST_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('RSS_ALL_QUERY projects "slug": slug.current', () => {
    const match = blogSource.match(/const RSS_ALL_QUERY\s*=\s*`([^`]+)`/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('"slug": slug.current');
  });

  it('all GROQ list query constants contain "slug": slug.current', () => {
    // Every *_LIST_QUERY must project slug as a string
    const listQueries = blogSource.match(/const \w+_LIST_QUERY\s*=\s*`[^`]+`/g) ?? [];
    expect(listQueries.length).toBeGreaterThan(0);
    for (const q of listQueries) {
      expect(q).toContain('"slug": slug.current');
    }
  });

  it('categories projections use "slug": slug.current (not bare slug)', () => {
    const categoryProjections = blogSource.match(/categories\[\]->\{[^}]+\}/g) ?? [];
    expect(categoryProjections.length).toBeGreaterThan(0);
    for (const proj of categoryProjections) {
      expect(proj).toContain('"slug": slug.current');
      // Must not have a bare comma-separated `slug` field that would return an object
      expect(proj).not.toMatch(/,\s*slug\s*[,}]/);
    }
  });

  it('no bare `slug` field in GROQ list/post query constants (would cause [object Object])', () => {
    const queryConstants = blogSource.match(/const \w+_(LIST|POST|RSS)_QUERY\s*=\s*`[^`]+`/g) ?? [];
    expect(queryConstants.length).toBeGreaterThan(0);
    for (const qc of queryConstants) {
      // A bare comma-separated `slug` would coerce to [object Object] in URLs
      const hasBareSlugField = /,\s*slug\s*[,}]/.test(qc);
      expect(hasBareSlugField).toBe(false);
    }
  });
});
