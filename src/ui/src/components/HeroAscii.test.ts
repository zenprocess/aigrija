import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'src/ui/src/components/HeroAscii.jsx');
const source = readFileSync(filePath, 'utf-8');

describe('HeroAscii component', () => {
  it('exports a default function', () => {
    expect(source).toContain('export default function HeroAscii');
  });

  it('has data-testid on interactive elements', () => {
    expect(source).toContain("'data-testid': 'hero-cta-btn'");
    expect(source).toContain("'data-testid': 'hero-ascii-shield'");
    expect(source).toContain("'data-testid': 'hero-terminal-header'");
    expect(source).toContain("'data-testid': 'hero-counter-badge'");
    expect(source).toContain("'data-testid': 'hero-tagline'");
  });

  it('uses useTranslation hook for i18n', () => {
    expect(source).toContain('useTranslation');
    expect(source).toContain("t('hero.cta')");
    expect(source).toContain("t('hero.subtitle')");
    expect(source).toContain("t('hero.counter_loading')");
  });

  it('uses green accent color #22c55e compatible values', () => {
    // The green palette: r:34 g:197 b:94
    expect(source).toContain('34,197,94');
  });

  it('has ASCII shield art with box-drawing characters', () => {
    expect(source).toContain('╔');
    expect(source).toContain('╝');
    expect(source).toContain('║');
    expect(source).toContain('═');
  });

  it('has section data-testid', () => {
    expect(source).toContain("'data-testid': 'hero-ascii-section'");
  });

  it('uses CSS animations only (no framer-motion)', () => {
    expect(source).not.toContain('framer-motion');
    expect(source).toContain('@keyframes');
  });

  it('handles mobile responsiveness', () => {
    expect(source).toContain('isMobile');
    expect(source).toContain('MOBILE_SHIELD_LINES');
  });
});

describe('Hero component delegates to HeroAscii', () => {
  it('imports HeroAscii', () => {
    const heroPath = join(process.cwd(), 'src/ui/src/components/Hero.jsx');
    const heroSource = readFileSync(heroPath, 'utf-8');
    expect(heroSource).toContain("import HeroAscii from './HeroAscii.jsx'");
    expect(heroSource).toContain('HeroAscii');
  });
});
