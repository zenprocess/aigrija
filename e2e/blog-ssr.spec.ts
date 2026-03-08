/**
 * Blog SSR content negotiation and language filtering tests.
 * Verifies Accept header handling (HTML vs JSON) and lang query param filtering.
 */
import { test, expect } from '@playwright/test';

test.describe('Blog SSR — content negotiation', () => {
  test('Accept text/html returns HTML with title and og tags', async ({ request }) => {
    const res = await request.get('/ghid', {
      headers: { Accept: 'text/html' },
    });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<title');
    expect(html).toMatch(/og:title/);
  });

  test('Accept text/html returns JSON-LD structured data', async ({ request }) => {
    const res = await request.get('/ghid', {
      headers: { Accept: 'text/html' },
    });
    const html = await res.text();
    expect(html).toContain('application/ld+json');
  });

  test('Accept application/json returns JSON array', async ({ request }) => {
    const res = await request.get('/ghid', {
      headers: { Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no Accept header defaults to JSON', async ({ request }) => {
    const res = await request.get('/ghid', {
      headers: { Accept: '*/*' },
    });
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    // Without explicit text/html, should return JSON
    expect(ct).toContain('application/json');
  });
});

test.describe('Blog SSR — language filtering', () => {
  test('lang=ro returns Romanian posts (default)', async ({ request }) => {
    const res = await request.get('/ghid?lang=ro', {
      headers: { Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const posts = await res.json();
    expect(Array.isArray(posts)).toBe(true);
  });

  test('lang=en returns English posts only', async ({ request }) => {
    const resEn = await request.get('/ghid?lang=en', {
      headers: { Accept: 'application/json' },
    });
    expect(resEn.status()).toBe(200);
    const enPosts = await resEn.json();
    expect(Array.isArray(enPosts)).toBe(true);

    // English results should not contain Romanian-only posts
    const resRo = await request.get('/ghid?lang=ro', {
      headers: { Accept: 'application/json' },
    });
    const roPosts = await resRo.json();

    // If both have results, their slugs should differ (language-filtered)
    if (enPosts.length > 0 && roPosts.length > 0) {
      const enSlugs = enPosts.map((p: Record<string, unknown>) =>
        typeof p.slug === 'object' && p.slug !== null ? (p.slug as Record<string, string>).current : p.slug
      );
      const roSlugs = roPosts.map((p: Record<string, unknown>) =>
        typeof p.slug === 'object' && p.slug !== null ? (p.slug as Record<string, string>).current : p.slug
      );
      // At least one slug set should differ (they are language-filtered)
      const overlap = enSlugs.filter((s: string) => roSlugs.includes(s));
      // Not all slugs should overlap — language filtering is active
      expect(overlap.length).toBeLessThan(Math.max(enSlugs.length, roSlugs.length));
    }
  });

  test('invalid lang returns 400', async ({ request }) => {
    const res = await request.get('/ghid?lang=xx', {
      headers: { Accept: 'application/json' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Blog SSR — single post', () => {
  test('single post HTML has og:type article', async ({ request }) => {
    // First get the list to find a real slug
    const listRes = await request.get('/ghid', {
      headers: { Accept: 'application/json' },
    });
    const posts = await listRes.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      test.skip(true, 'No posts available to test single post SSR');
      return;
    }

    const firstPost = posts[0] as Record<string, unknown>;
    const slug = typeof firstPost.slug === 'object' && firstPost.slug !== null
      ? (firstPost.slug as Record<string, string>).current
      : firstPost.slug;

    if (!slug) {
      test.skip(true, 'First post has no slug');
      return;
    }

    const res = await request.get(`/ghid/${slug}`, {
      headers: { Accept: 'text/html' },
    });
    expect(res.status()).toBe(200);

    const html = await res.text();
    expect(html).toContain('og:type');
    expect(html).toContain('article');
  });
});
