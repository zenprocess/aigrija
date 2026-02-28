import { describe, it, expect } from 'vitest';
import { analyzeUrl } from './url-analyzer';

describe('analyzeUrl', () => {
  it('returns safe for official domains', async () => {
    const result = await analyzeUrl('https://ing.ro/homebank');
    expect(result.is_suspicious).toBe(false);
    expect(result.risk_score).toBe(0);
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });

  it('flags HTTP protocol', async () => {
    const result = await analyzeUrl('http://example.com');
    expect(result.flags).toContain('Conexiune nesecurizata (HTTP)');
    expect(result.safe_browsing_match).toBe(false);
  });

  it('flags long domains', async () => {
    const result = await analyzeUrl('https://this-is-a-very-long-domain-name-that-exceeds-thirty-chars.com');
    expect(result.flags).toContain('Domeniu neobisnuit de lung');
  });

  it('detects look-alike domains', async () => {
    const result = await analyzeUrl('https://ing-romania.com/login');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags.some(f => f.includes('look-alike'))).toBe(true);
  });

  it('flags URL shorteners', async () => {
    const result = await analyzeUrl('https://bit.ly/abc123');
    expect(result.flags).toContain('URL scurtat — destinatia reala este ascunsa');
  });

  it('flags suspicious TLDs', async () => {
    const result = await analyzeUrl('https://ing-bank.xyz');
    expect(result.is_suspicious).toBe(true);
  });

  it('handles invalid URLs', async () => {
    const result = await analyzeUrl('not a url at all !!!');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags).toContain('URL invalid sau malformat');
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });

  it('flags domains with many digits', async () => {
    const result = await analyzeUrl('https://login12345.com');
    expect(result.flags).toContain('Domeniu cu multe cifre');
  });

  it('flags too many subdomains', async () => {
    const result = await analyzeUrl('https://a.b.c.d.example.com');
    expect(result.flags).toContain('Prea multe subdomenii');
  });

  it('skips Safe Browsing when no API key provided', async () => {
    const result = await analyzeUrl('https://example.com');
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });
});
