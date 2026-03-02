import { describe, it, expect } from 'vitest';
import { renderErrorPage } from './error-pages';

describe('renderErrorPage', () => {
  const statuses = [400, 403, 404, 429, 500, 503];

  statuses.forEach((status) => {
    it(`renders valid HTML for ${status}`, () => {
      const html = renderErrorPage(status, 'test', 'req-123');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="ro">');
      expect(html).toContain('<svg');
      expect(html).toContain('req-123');
    });
  });

  it('404 includes home link', () => {
    const html = renderErrorPage(404, 'not found', 'r1');
    expect(html).toContain('Înapoi acasă');
    expect(html).toContain('href="/"');
  });

  it('429 includes retry hint', () => {
    const html = renderErrorPage(429, 'rate limited', 'r2');
    expect(html).toContain('Încercați din nou');
  });

  it('500 includes auto-refresh meta', () => {
    const html = renderErrorPage(500, 'error', 'r3');
    expect(html).toContain('http-equiv="refresh"');
  });

  it('503 includes auto-refresh meta', () => {
    const html = renderErrorPage(503, 'down', 'r4');
    expect(html).toContain('http-equiv="refresh"');
  });

  it('unknown status falls back to generic', () => {
    const html = renderErrorPage(418, 'teapot', 'r5');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Eroare');
    expect(html).toContain('<svg');
  });

  it('no external resource references', () => {
    const html = renderErrorPage(404, 'test', 'r6');
    // Allow w3.org namespace URIs (xmlns in SVG) but block external resource loads
    expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\/(?!ai-grija)/i);
    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    expect(html).not.toMatch(/<img[^>]+src=["']https?:\/\/(?!ai-grija)/i);
  });

  it('each status code produces a unique avatar (different seeds)', () => {
    const statuses = [400, 403, 404, 429, 500, 503];
    const svgs = statuses.map((s) => {
      const html = renderErrorPage(s, 'msg', 'rid');
      // Extract the SVG from within the avatar div
      const match = html.match(/<div class="av">(<svg[\s\S]*?<\/svg>)<\/div>/);
      return match ? match[1] : '';
    });
    // All SVGs should be non-empty
    svgs.forEach((svg) => expect(svg).toContain('<svg'));
    // Each SVG should be unique (different seed → different content)
    const unique = new Set(svgs);
    expect(unique.size).toBe(statuses.length);
  });

  it('renderErrorPage produces text/html-compatible output (doctype + html root)', () => {
    const html = renderErrorPage(404, 'not found', 'rid-ct');
    // Verify structural markers that indicate this is an HTML document
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<html lang="ro">');
    expect(html).toContain('</html>');
  });
});
