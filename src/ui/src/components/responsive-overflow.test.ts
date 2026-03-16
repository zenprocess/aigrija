import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf-8');

describe('Responsive CSS — no horizontal overflow at all breakpoints', () => {
  describe('index.css global overflow prevention', () => {
    const css = read('src/ui/src/index.css');

    it('html element has overflow-x: hidden', () => {
      // Must appear inside the html rule block
      const htmlBlock = css.match(/html\s*\{[^}]*\}/s)?.[0] ?? '';
      expect(htmlBlock).toContain('overflow-x: hidden');
    });

    it('body element has overflow-x: hidden', () => {
      const bodyBlock = css.match(/body\s*\{[^}]*\}/s)?.[0] ?? '';
      expect(bodyBlock).toContain('overflow-x: hidden');
    });

    it('media elements have max-width: 100%', () => {
      expect(css).toContain('max-width: 100%');
    });

    it('prose-content has overflow-wrap: break-word', () => {
      expect(css).toContain('overflow-wrap: break-word');
    });

    it('prose-content has word-break: break-word', () => {
      expect(css).toContain('word-break: break-word');
    });

    it('pre elements inside content areas have overflow-x: auto', () => {
      expect(css).toContain('overflow-x: auto');
    });

    it('tables inside content areas are scrollable', () => {
      // table rule must include display: block and overflow-x: auto
      expect(css).toMatch(/\.prose-content table[\s\S]*?overflow-x: auto/);
    });
  });

  describe('App.jsx — top-level containers have overflow-x-hidden', () => {
    const source = read('src/ui/src/App.jsx');

    it('PageShell div has overflow-x-hidden', () => {
      expect(source).toContain('overflow-x-hidden');
    });

    it('root div has overflow-x-hidden', () => {
      // Both PageShell and the main return div
      const matches = source.match(/overflow-x-hidden/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Header.jsx — responsive nav layout', () => {
    const source = read('src/ui/src/components/Header.jsx');

    it('header is fixed with left-0 right-0 (full width, no overflow)', () => {
      expect(source).toContain('fixed top-0 left-0 right-0');
    });

    it('nav container uses responsive padding px-4 sm:px-6 lg:px-8', () => {
      expect(source).toContain('px-4 sm:px-6 lg:px-8');
    });

    it('desktop nav is hidden on mobile/tablet (hidden lg:flex)', () => {
      expect(source).toContain('hidden lg:flex');
    });

    it('mobile menu panel uses left-0 right-0 (full viewport width)', () => {
      expect(source).toContain('left-0 right-0');
    });
  });

  describe('ContentPost.jsx — content layout', () => {
    const source = read('src/ui/src/components/ContentPost.jsx');

    it('uses max-w-3xl for narrow readable column', () => {
      expect(source).toContain('max-w-3xl');
    });

    it('uses responsive padding px-4 sm:px-6 lg:px-8', () => {
      expect(source).toContain('px-4 sm:px-6 lg:px-8');
    });

    it('images have w-full class to constrain to container width', () => {
      expect(source).toContain('w-full');
    });
  });

  describe('ActiveAlerts.jsx — section layout', () => {
    const source = read('src/ui/src/components/ActiveAlerts.jsx');

    it('uses max-w-4xl with responsive padding', () => {
      expect(source).toContain('max-w-4xl');
      expect(source).toContain('px-4 sm:px-6 lg:px-8');
    });
  });

  describe('HeroAscii.jsx — canvas responsiveness', () => {
    const source = read('src/ui/src/components/HeroAscii.jsx');

    it('handles mobile responsiveness with isMobile check', () => {
      expect(source).toContain('isMobile');
      expect(source).toContain('buildMobileShieldLines');
    });

    it('has overflow-hidden on hero section to clip canvas', () => {
      expect(source).toContain('overflow-hidden');
    });
  });
});
