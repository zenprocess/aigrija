import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'src/ui/src/components/CookieConsent.jsx');
const source = readFileSync(filePath, 'utf-8');

describe('CookieConsent exports', () => {
  it('exports getConsentPreferences', () => {
    expect(source).toContain('export function getConsentPreferences');
  });

  it('exports hasAnalyticsConsent', () => {
    expect(source).toContain('export function hasAnalyticsConsent');
  });

  it('exports default CookieConsent component', () => {
    expect(source).toContain('export default function CookieConsent');
  });
});

describe('CookieConsent data-testid attributes', () => {
  it('has data-testid on the banner wrapper', () => {
    expect(source).toContain('data-testid="consent-banner"');
  });

  it('has data-testid on accept-all button', () => {
    expect(source).toContain('data-testid="consent-accept-all"');
  });

  it('has data-testid on reject button', () => {
    expect(source).toContain('data-testid="consent-reject-btn"');
  });

  it('has data-testid on settings button', () => {
    expect(source).toContain('data-testid="consent-settings-btn"');
  });

  it('has data-testid on analytics toggle', () => {
    expect(source).toContain('data-testid="consent-analytics-toggle"');
  });

  it('has data-testid on save preferences button', () => {
    expect(source).toContain('data-testid="consent-save-btn"');
  });
});

describe('CookieConsent localStorage behaviour', () => {
  it('reads cookie_consent_given on mount', () => {
    expect(source).toContain("cookie_consent_given");
  });

  it('stores consent timestamp in cookie_preferences', () => {
    expect(source).toContain('timestamp');
    expect(source).toContain('new Date().toISOString()');
  });

  it('stores essential and analytics flags', () => {
    expect(source).toContain('essential: true');
    expect(source).toContain('analytics');
  });

  it('reads from cookie_preferences for hasAnalyticsConsent', () => {
    expect(source).toContain("cookie_preferences");
    expect(source).toContain('.analytics === true');
  });
});

describe('CookieConsent Umami analytics gating', () => {
  it('defines injectUmamiScript function', () => {
    expect(source).toContain('function injectUmamiScript');
  });

  it('injects Umami script dynamically (not via HTML script tag)', () => {
    expect(source).toContain("createElement('script')");
    expect(source).toContain('cloud.umami.is/script.js');
  });

  it('gates Umami injection on analytics consent', () => {
    expect(source).toContain('hasAnalyticsConsent()');
    expect(source).toContain('injectUmamiScript()');
  });

  it('injects Umami after accept-all', () => {
    // handleAcceptAll should call injectUmamiScript after saveConsent(true)
    const acceptAllBlock = source.slice(
      source.indexOf('function handleAcceptAll'),
      source.indexOf('function handleRejectAll')
    );
    expect(acceptAllBlock).toContain('injectUmamiScript');
  });

  it('does not inject Umami when analytics is rejected', () => {
    const rejectBlock = source.slice(
      source.indexOf('function handleRejectAll'),
      source.indexOf('function handleSavePreferences')
    );
    expect(rejectBlock).not.toContain('injectUmamiScript');
  });
});

describe('CookieConsent visibility logic', () => {
  it('starts hidden (visible=false)', () => {
    expect(source).toContain('useState(false)');
  });

  it('returns null when not visible', () => {
    expect(source).toContain('if (!visible) return null');
  });

  it('has optional onVisibilityChange callback prop', () => {
    expect(source).toContain('onVisibilityChange');
  });
});
