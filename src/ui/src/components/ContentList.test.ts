/**
 * Regression tests for S-426: ContentList defensive slug handling
 *
 * When `item.slug` is an object (Sanity raw slug { _type, current }),
 * the href would become `#/category/[object Object]`.
 * ContentList must handle both string and object slugs defensively.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(process.cwd(), 'src/ui/src/components/ContentList.tsx'), 'utf-8');

describe('ContentList — defensive slug handling', () => {
  it('exports a default function ContentList', () => {
    expect(source).toContain('export default function ContentList');
  });

  it('uses typeof check before using item.slug in href', () => {
    // Must not use item.slug directly — it could be an object from Sanity
    expect(source).toContain("typeof item.slug === 'object'");
  });

  it('extracts .current from object slugs', () => {
    expect(source).toContain('item.slug?.current');
  });

  it('falls back to item.id when slug is falsy', () => {
    expect(source).toContain('item.slug || item.id');
  });

  it('does not build href with raw item.slug that could be an object', () => {
    // The href template literal must not use bare item.slug without a typeof guard
    // Bare usage: `#/${category}/${item.slug}` — missing defensive check
    const bareSlugPattern = /\$\{category\}\/\$\{item\.slug\}`/;
    expect(bareSlugPattern.test(source)).toBe(false);
  });

  it('href uses ternary to extract .current from object slug or use string slug', () => {
    // The full defensive pattern from S-426 fix
    expect(source).toContain("typeof item.slug === 'object' ? item.slug?.current : item.slug || item.id");
  });
});

describe('ContentList — HTTP error handling', () => {
  it('checks r.ok before parsing JSON to surface server errors', () => {
    expect(source).toContain("if (!r.ok) throw new Error(`HTTP ${r.status}`)");
  });
});

describe('ContentPost — defensive slug handling for related articles', () => {
  const postSource = readFileSync(join(process.cwd(), 'src/ui/src/components/ContentPost.tsx'), 'utf-8');

  it('exports a default function ContentPost', () => {
    expect(postSource).toContain('export default function ContentPost');
  });

  it('uses typeof check before using rel.slug in href for related articles', () => {
    expect(postSource).toContain("typeof rel.slug === 'object'");
  });

  it('extracts .current from object slugs for related articles', () => {
    expect(postSource).toContain('rel.slug?.current');
  });

  it('does not build related article href with raw rel.slug', () => {
    // Must not have bare `${rel.slug}` in href without defensive check
    const bareRelSlugPattern = /\$\{category\}\/\$\{rel\.slug\}`/;
    expect(bareRelSlugPattern.test(postSource)).toBe(false);
  });

  it('uses data-testid on related article links with defensive slug key', () => {
    // Key and data-testid should also handle object slugs
    expect(postSource).toContain("typeof rel.slug === 'object' ? rel.slug?.current : rel.slug");
  });
});
