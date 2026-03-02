import { describe, it, expect } from 'vitest';
import { getAllowedOrigin, applyCorsHeaders, getCacheControl, handleCorsPreflight } from './cdn-headers';

describe('getAllowedOrigin', () => {
  it('reflects https://ai-grija.ro', () => {
    expect(getAllowedOrigin('https://ai-grija.ro')).toBe('https://ai-grija.ro');
  });

  it('reflects https://www.ai-grija.ro', () => {
    expect(getAllowedOrigin('https://www.ai-grija.ro')).toBe('https://www.ai-grija.ro');
  });

  it('reflects https://cdn.ai-grija.ro', () => {
    expect(getAllowedOrigin('https://cdn.ai-grija.ro')).toBe('https://cdn.ai-grija.ro');
  });

  it('returns null for disallowed origin', () => {
    expect(getAllowedOrigin('https://evil.com')).toBeNull();
  });

  it('returns null for null origin', () => {
    expect(getAllowedOrigin(null)).toBeNull();
  });

  it('returns null for undefined origin', () => {
    expect(getAllowedOrigin(undefined)).toBeNull();
  });

  it('is case-sensitive — does not reflect uppercase variant', () => {
    expect(getAllowedOrigin('https://AI-GRIJA.RO')).toBeNull();
  });
});

describe('applyCorsHeaders', () => {
  it('sets CORS headers for allowed origin', () => {
    const headers = new Headers();
    applyCorsHeaders(headers, 'https://ai-grija.ro');
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://ai-grija.ro');
    expect(headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
    expect(headers.get('Access-Control-Max-Age')).toBe('86400');
    expect(headers.get('Vary')).toBe('Origin');
  });

  it('does not set CORS headers for disallowed origin', () => {
    const headers = new Headers();
    applyCorsHeaders(headers, 'https://evil.com');
    expect(headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('does not set CORS headers when origin is absent', () => {
    const headers = new Headers();
    applyCorsHeaders(headers, null);
    expect(headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('getCacheControl', () => {
  it('returns immutable for hashed JS file', () => {
    expect(getCacheControl('assets/app.a1b2c3d4e5.js')).toBe('public, max-age=31536000, immutable');
  });

  it('returns immutable for hashed CSS file', () => {
    expect(getCacheControl('assets/main.abc123def.css')).toBe('public, max-age=31536000, immutable');
  });

  it('returns immutable for woff2 font', () => {
    expect(getCacheControl('fonts/inter.woff2')).toBe('public, max-age=31536000, immutable');
  });

  it('returns immutable for ttf font', () => {
    expect(getCacheControl('fonts/roboto.ttf')).toBe('public, max-age=31536000, immutable');
  });

  it('returns image cache for PNG', () => {
    expect(getCacheControl('share/abc.png')).toBe('public, max-age=2592000, stale-while-revalidate=3600');
  });

  it('returns image cache for SVG', () => {
    expect(getCacheControl('share/abc.svg')).toBe('public, max-age=2592000, stale-while-revalidate=3600');
  });

  it('returns image cache for WEBP', () => {
    expect(getCacheControl('banner.webp')).toBe('public, max-age=2592000, stale-while-revalidate=3600');
  });

  it('returns image cache for ICO', () => {
    expect(getCacheControl('favicon.ico')).toBe('public, max-age=2592000, stale-while-revalidate=3600');
  });

  it('returns must-revalidate for HTML', () => {
    expect(getCacheControl('index.html')).toBe('public, max-age=0, must-revalidate');
  });

  it('returns default for unknown extension', () => {
    expect(getCacheControl('data.json')).toBe('public, max-age=3600');
  });

  it('returns default for extensionless path', () => {
    expect(getCacheControl('api/health')).toBe('public, max-age=3600');
  });

  it('does not treat non-hashed JS as immutable', () => {
    // "app.js" has no hash segment — should fall through to default
    expect(getCacheControl('app.js')).toBe('public, max-age=3600');
  });
});

describe('handleCorsPreflight', () => {
  it('returns 204 for allowed origin', () => {
    const res = handleCorsPreflight('https://ai-grija.ro');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ai-grija.ro');
  });

  it('returns 204 with no CORS headers for disallowed origin', () => {
    const res = handleCorsPreflight('https://evil.com');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
