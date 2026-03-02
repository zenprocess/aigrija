import { describe, it, expect } from 'vitest';
import { generateMetaTags, escapeHtml } from './seo';

describe('escapeHtml', () => {
  it('escapes ampersand', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes quotes', () => expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;'));
  it('escapes angle brackets', () => expect(escapeHtml('<b>')).toBe('&lt;b&gt;'));
  it('returns plain string unchanged', () => expect(escapeHtml('hello')).toBe('hello'));
});

describe('generateMetaTags', () => {
  it('includes title tag', () => {
    const tags = generateMetaTags({ title: 'Test', description: 'Desc', canonicalUrl: 'https://ai-grija.ro/', ogType: 'website', language: 'ro' });
    expect(tags).toContain('<title>Test | ai-grija.ro</title>');
  });

  it('includes og:type', () => {
    const tags = generateMetaTags({ title: 'T', description: 'D', canonicalUrl: 'https://ai-grija.ro/', ogType: 'article', language: 'ro' });
    expect(tags).toContain('og:type" content="article"');
  });

  it('includes og:image when provided', () => {
    const tags = generateMetaTags({ title: 'T', description: 'D', canonicalUrl: 'https://ai-grija.ro/', ogType: 'website', language: 'ro', ogImage: 'https://img.png' });
    expect(tags).toContain('og:image');
  });

  it('includes JSON-LD script when provided', () => {
    const tags = generateMetaTags({ title: 'T', description: 'D', canonicalUrl: 'https://ai-grija.ro/', ogType: 'website', language: 'ro', jsonLd: { '@type': 'Article' } });
    expect(tags).toContain('application/ld+json');
    expect(tags).toContain('"@type":"Article"');
  });

  it('includes hreflang alternate links', () => {
    const tags = generateMetaTags({
      title: 'T', description: 'D', canonicalUrl: 'https://ai-grija.ro/', ogType: 'website', language: 'ro',
      alternateLanguages: [{ lang: 'en', url: 'https://ai-grija.ro/en/' }],
    });
    expect(tags).toContain('hreflang="en"');
  });

  it('includes canonical link', () => {
    const tags = generateMetaTags({ title: 'T', description: 'D', canonicalUrl: 'https://ai-grija.ro/test', ogType: 'website', language: 'ro' });
    expect(tags).toContain('<link rel="canonical" href="https://ai-grija.ro/test">');
  });
});
