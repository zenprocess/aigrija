import { describe, it, expect } from 'vitest';
import { renderBlogListPage, renderBlogPostPage } from './blog-page';

const mockPosts = [
  {
    title: 'Cum sa va protejati contul bancar online',
    slug: { current: 'cum-sa-va-protejati-contul-bancar-online' },
    excerpt: 'Ghid complet pentru securitatea bancara online.',
    publishedAt: '2025-06-15T10:00:00Z',
    author: { name: 'Maria Ionescu' },
    mainImage: { asset: { url: 'https://cdn.ai-grija.ro/images/bank-security.jpg' } },
    body: [
      { _type: 'block', style: 'normal', children: [{ text: 'Introducere in securitatea bancara.' }] },
      { _type: 'block', style: 'h2', children: [{ text: 'Pasul 1: Parola puternica' }] },
      {
        _type: 'block',
        style: 'normal',
        children: [
          { text: 'Folositi o parola ', marks: [] },
          { text: 'puternica', marks: ['strong'] },
          { text: ' si ', marks: [] },
          { text: 'unica', marks: ['em'] },
          { text: '.', marks: [] },
        ],
      },
      { _type: 'block', style: 'blockquote', children: [{ text: 'Securitatea incepe cu tine.' }] },
      { _type: 'image', asset: { url: 'https://cdn.ai-grija.ro/images/password.jpg' }, alt: 'Parola puternica' },
    ],
  },
  {
    title: 'Autentificarea in doi pasi',
    slug: { current: 'autentificarea-in-doi-pasi' },
    excerpt: 'De ce 2FA este esential.',
    publishedAt: '2025-06-10T10:00:00Z',
    author: { name: 'Ion Popescu' },
  },
];

const BASE_URL = 'https://ai-grija.ro';

describe('renderBlogListPage', () => {
  const html = renderBlogListPage(mockPosts, 'ghid', 'ro', 1, BASE_URL);

  it('returns valid HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ro">');
  });

  it('contains SEO title', () => {
    expect(html).toContain('<title>Ghiduri de Protectie — ai-grija.ro</title>');
  });

  it('contains meta description', () => {
    expect(html).toContain('<meta name="description"');
  });

  it('contains og:title meta tag', () => {
    expect(html).toContain('<meta property="og:title"');
  });

  it('contains canonical link', () => {
    expect(html).toContain('<link rel="canonical"');
  });

  it('contains JSON-LD structured data', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('CollectionPage');
  });

  it('lists post titles as linked cards', () => {
    expect(html).toContain('Cum sa va protejati contul bancar online');
    expect(html).toContain('/ghid/cum-sa-va-protejati-contul-bancar-online');
    expect(html).toContain('Autentificarea in doi pasi');
  });

  it('contains post excerpts', () => {
    expect(html).toContain('Ghid complet pentru securitatea bancara online.');
  });

  it('contains author names', () => {
    expect(html).toContain('Maria Ionescu');
    expect(html).toContain('Ion Popescu');
  });

  it('contains site navigation', () => {
    expect(html).toContain('Verificator');
    expect(html).toContain('Ghiduri');
    expect(html).toContain('Educatie');
    expect(html).toContain('Amenintari');
    expect(html).toContain('Rapoarte');
  });

  it('contains RSS feed link', () => {
    expect(html).toContain('/ghid/feed.xml');
  });

  it('contains footer with privacy and terms links', () => {
    expect(html).toContain('/politica-confidentialitate');
    expect(html).toContain('/termeni');
  });

  it('handles different categories', () => {
    const educatieHtml = renderBlogListPage([], 'educatie', 'ro', 1, BASE_URL);
    expect(educatieHtml).toContain('Educatie Digitala');
    expect(educatieHtml).toContain('/educatie/feed.xml');
  });

  it('handles non-Romanian language', () => {
    const enHtml = renderBlogListPage(mockPosts, 'ghid', 'en', 1, BASE_URL);
    expect(enHtml).toContain('<html lang="en">');
    expect(enHtml).toContain('?lang=en');
  });

  it('handles empty posts array', () => {
    const emptyHtml = renderBlogListPage([], 'ghid', 'ro', 1, BASE_URL);
    expect(emptyHtml).toContain('Nu exista articole');
  });
});

describe('renderBlogPostPage', () => {
  const post = mockPosts[0];
  const html = renderBlogPostPage(post, 'ghid', 'ro', BASE_URL);

  it('returns valid HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ro">');
  });

  it('contains SEO title from post', () => {
    expect(html).toContain('<title>Cum sa va protejati contul bancar online — ai-grija.ro</title>');
  });

  it('contains meta description from excerpt', () => {
    expect(html).toContain('content="Ghid complet pentru securitatea bancara online."');
  });

  it('contains og:title meta tag', () => {
    expect(html).toContain('<meta property="og:title" content="Cum sa va protejati contul bancar online">');
  });

  it('contains og:image when mainImage is present', () => {
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain('bank-security.jpg');
  });

  it('contains canonical link', () => {
    expect(html).toContain('<link rel="canonical" href="https://ai-grija.ro/ghid/cum-sa-va-protejati-contul-bancar-online">');
  });

  it('contains JSON-LD Article schema', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Article"');
  });

  it('renders breadcrumb navigation', () => {
    expect(html).toContain('ai-grija.ro');
    expect(html).toContain('Ghiduri de Protectie');
  });

  it('displays author and date', () => {
    expect(html).toContain('Maria Ionescu');
    expect(html).toContain('iunie');
  });

  it('displays reading time', () => {
    expect(html).toContain('min citire');
  });

  it('renders hero image', () => {
    expect(html).toContain('<img class="article-hero"');
    expect(html).toContain('bank-security.jpg');
  });

  it('renders Portable Text body content', () => {
    expect(html).toContain('Introducere in securitatea bancara.');
    expect(html).toContain('<h2>Pasul 1: Parola puternica</h2>');
    expect(html).toContain('<strong>puternica</strong>');
    expect(html).toContain('<em>unica</em>');
    expect(html).toContain('<blockquote>Securitatea incepe cu tine.</blockquote>');
  });

  it('renders images in body', () => {
    expect(html).toContain('password.jpg');
    expect(html).toContain('Parola puternica');
  });

  it('contains share button', () => {
    expect(html).toContain('Copiaza linkul');
  });

  it('contains back link to category', () => {
    expect(html).toContain('Inapoi la Ghiduri de Protectie');
    expect(html).toContain('href="/ghid"');
  });

  it('shows language disclaimer for non-Romanian', () => {
    const enHtml = renderBlogPostPage(post, 'ghid', 'en', BASE_URL);
    expect(enHtml).toContain('versiunea oficiala');
    expect(html).not.toContain('versiunea oficiala');
  });

  it('handles post without image', () => {
    const noImgPost = { ...mockPosts[1], body: [] };
    const noImgHtml = renderBlogPostPage(noImgPost, 'ghid', 'ro', BASE_URL);
    expect(noImgHtml).not.toContain('<img class="article-hero"');
    expect(noImgHtml).not.toContain('og:image');
  });
});
