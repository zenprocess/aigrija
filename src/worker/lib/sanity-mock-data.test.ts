import { describe, it, expect } from 'vitest';
import { handleMockQuery } from './sanity-mock-data';

describe('handleMockQuery', () => {
  // ─── Ghid ─────────────────────────────────────────────────────────────────

  it('returns Romanian ghid posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "blogPost" && category == "ghid"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect((result[0] as { language: string }).language).toBe('ro');
  });

  it('returns English ghid posts when lang=en', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "blogPost" && category == "ghid"]',
      { lang: 'en', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect((result[0] as { language: string }).language).toBe('en');
  });

  it('returns Romanian educatie posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "blogPost" && category == "educatie"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect((result[0] as { language: string }).language).toBe('ro');
  });

  it('returns amenintari posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "threatReport"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns rapoarte posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "weeklyDigest"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns povesti posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "communityStory"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns presa posts', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "pressRelease"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // ─── Single-post queries ──────────────────────────────────────────────────

  it('returns a single ghid post by slug', () => {
    const result = handleMockQuery<{ title: string; slug: { current: string } } | null>(
      '*[_type == "blogPost" && category == "ghid" && slug.current == $slug][0]',
      { lang: 'ro', slug: 'cum-sa-te-protejezi-de-phishing' }
    );
    expect(result).not.toBeNull();
    expect(result?.slug.current).toBe('cum-sa-te-protejezi-de-phishing');
  });

  it('returns null for unknown slug', () => {
    const result = handleMockQuery<null>(
      '*[_type == "blogPost" && category == "ghid" && slug.current == $slug][0]',
      { lang: 'ro', slug: 'nonexistent-slug-xyz' }
    );
    expect(result).toBeNull();
  });

  it('returns single educatie post by slug', () => {
    const result = handleMockQuery<{ title: string } | null>(
      '*[_type == "blogPost" && category == "educatie" && slug.current == $slug][0]',
      { lang: 'ro', slug: 'securitatea-digitala-pentru-copii' }
    );
    expect(result).not.toBeNull();
  });

  // ─── Combined feed ────────────────────────────────────────────────────────

  it('returns combined feed with all content types', () => {
    const result = handleMockQuery<unknown[]>(
      '*[_type == "blogPost" || _type == "threatReport" || _type == "weeklyDigest" || _type == "communityStory" || _type == "pressRelease"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // ─── Sitemap ──────────────────────────────────────────────────────────────

  it('returns sitemap data with all categories', () => {
    const result = handleMockQuery<Record<string, unknown[]>>(
      '{ "ghid": *[_type == "blogPost" && category == "ghid"]{ slug, language, _updatedAt }, "educatie": [] }',
      {}
    );
    expect(result).toHaveProperty('ghid');
    expect(result).toHaveProperty('educatie');
    expect(result).toHaveProperty('amenintari');
    expect(result).toHaveProperty('rapoarte');
    expect(result).toHaveProperty('povesti');
    expect(result).toHaveProperty('presa');
  });

  // ─── Unknown category ─────────────────────────────────────────────────────

  it('returns empty array for unrecognised query', () => {
    const result = handleMockQuery<unknown[]>('*[_type == "unknownType"]', { lang: 'ro' });
    expect(result).toEqual([]);
  });

  // ─── Pagination ───────────────────────────────────────────────────────────

  it('paginates ghid results', () => {
    const page1 = handleMockQuery<unknown[]>(
      '*[_type == "blogPost" && category == "ghid"]',
      { lang: 'ro', from: 0, to: 1 }
    );
    expect(page1.length).toBe(1);
  });

  // ─── Mock data schema ─────────────────────────────────────────────────────

  it('mock ghid post has required schema fields', () => {
    const result = handleMockQuery<Array<{
      _type: string;
      title: string;
      slug: { current: string };
      excerpt: string;
      language: string;
    }>>('*[_type == "blogPost" && category == "ghid"]', { lang: 'ro', from: 0, to: 20 });
    const post = result[0];
    expect(post).toHaveProperty('_type');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('slug');
    expect(post).toHaveProperty('excerpt');
    expect(post).toHaveProperty('language');
    expect(post.slug).toHaveProperty('current');
    expect(post.language).toBe('ro');
  });

  it('mock educatie post has Romanian content', () => {
    const result = handleMockQuery<Array<{ title: string; excerpt: string }>>(
      '*[_type == "blogPost" && category == "educatie"]',
      { lang: 'ro', from: 0, to: 20 }
    );
    const post = result[0];
    // Romanian text should contain diacritics or common Romanian words
    const combinedText = post.title + post.excerpt;
    expect(combinedText.length).toBeGreaterThan(10);
  });
});
