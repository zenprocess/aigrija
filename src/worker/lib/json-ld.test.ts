import { describe, it, expect } from 'vitest';
import { articleJsonLd, breadcrumbJsonLd, websiteJsonLd } from './json-ld';

describe('articleJsonLd', () => {
  it('has required schema.org fields', () => {
    const ld = articleJsonLd({
      title: 'Test Article',
      description: 'Test description',
      datePublished: '2026-01-01',
      dateModified: '2026-02-01',
    });
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Article');
    expect(ld.headline).toBe('Test Article');
    expect(ld.datePublished).toBe('2026-01-01');
    expect(ld.dateModified).toBe('2026-02-01');
  });

  it('includes optional author and image if provided', () => {
    const ld = articleJsonLd({
      title: 'T',
      description: 'D',
      datePublished: '2026-01-01',
      dateModified: '2026-01-01',
      author: 'ai-grija.ro',
      image: 'https://ai-grija.ro/img.png',
    });
    expect((ld.author as { name: string }).name).toBe('ai-grija.ro');
    expect(ld.image).toBe('https://ai-grija.ro/img.png');
  });
});

describe('breadcrumbJsonLd', () => {
  it('generates correct BreadcrumbList', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Acasa', url: 'https://ai-grija.ro/' },
      { name: 'Alerte', url: 'https://ai-grija.ro/alerte' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].position).toBe(2);
    expect(ld.itemListElement[0].name).toBe('Acasa');
  });
});

describe('websiteJsonLd', () => {
  it('has WebSite type and SearchAction', () => {
    const ld = websiteJsonLd();
    expect(ld['@type']).toBe('WebSite');
    expect(ld.name).toBe('ai-grija.ro');
    expect(ld.potentialAction['@type']).toBe('SearchAction');
  });
});
