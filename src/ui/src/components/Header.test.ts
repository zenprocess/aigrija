/**
 * Regression tests for S-452: Check nav button anchor navigation broken
 *
 * The scrollTo function must not rely on a fixed timeout when navigating
 * from a SPA route to home. Instead it must persist the scroll intent via
 * sessionStorage so that the Checker component can consume it on mount.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const headerSource = readFileSync(join(process.cwd(), 'src/ui/src/components/Header.tsx'), 'utf-8');
const checkerSource = readFileSync(join(process.cwd(), 'src/ui/src/components/Checker.tsx'), 'utf-8');

describe('Header — scrollTo nav anchor fix', () => {
  it('has header-nav-verifica button that calls scrollTo', () => {
    expect(headerSource).toContain("data-testid=\"header-nav-verifica\"");
    expect(headerSource).toContain("scrollTo('verifica')");
  });

  it('has mobile verifica button that calls scrollTo', () => {
    expect(headerSource).toContain("data-testid=\"header-mobile-verifica\"");
    expect(headerSource).toContain("scrollTo('verifica')");
  });

  it('scrollTo persists pendingScrollId to sessionStorage when element is absent', () => {
    expect(headerSource).toContain("sessionStorage.setItem('pendingScrollId', id)");
  });

  it('scrollTo navigates home by clearing the hash', () => {
    expect(headerSource).toContain("window.location.hash = ''");
  });

  it('does not use a fragile setTimeout for post-navigation scroll', () => {
    // The old approach used setTimeout which races against React re-render
    const hasTimeoutScroll = /setTimeout\s*\(\s*\(\)\s*=>[\s\S]{0,100}scrollIntoView/.test(headerSource);
    expect(hasTimeoutScroll).toBe(false);
  });
});

describe('Checker — pendingScrollId consumption on mount', () => {
  it('reads pendingScrollId from sessionStorage on mount', () => {
    expect(checkerSource).toContain("sessionStorage.getItem('pendingScrollId')");
  });

  it('removes pendingScrollId from sessionStorage after consuming it', () => {
    expect(checkerSource).toContain("sessionStorage.removeItem('pendingScrollId')");
  });

  it('scrolls to the element after consuming the pending id', () => {
    expect(checkerSource).toContain("el.scrollIntoView({ behavior: 'smooth' })");
  });

  it('uses requestAnimationFrame to defer the scroll until after paint', () => {
    expect(checkerSource).toContain('requestAnimationFrame');
  });

  it('checker section has id="verifica" matching the scrollTo target', () => {
    expect(checkerSource).toContain('id="verifica"');
  });
});
