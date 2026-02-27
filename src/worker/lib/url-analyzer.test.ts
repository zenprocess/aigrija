import { describe, it, expect } from 'vitest';
import { analyzeUrl } from './url-analyzer';

describe('analyzeUrl', () => {
  it('returns safe for official domains', () => {
    const result = analyzeUrl('https://ing.ro/homebank');
    expect(result.is_suspicious).toBe(false);
    expect(result.risk_score).toBe(0);
  });

  it('flags HTTP protocol', () => {
    const result = analyzeUrl('http://example.com');
    expect(result.flags).toContain('Conexiune nesecurizata (HTTP)');
  });

  it('flags long domains', () => {
    const result = analyzeUrl('https://this-is-a-very-long-domain-name-that-exceeds-thirty-chars.com');
    expect(result.flags).toContain('Domeniu neobisnuit de lung');
  });

  it('detects look-alike domains', () => {
    const result = analyzeUrl('https://ing-romania.com/login');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags.some(f => f.includes('look-alike'))).toBe(true);
  });

  it('flags URL shorteners', () => {
    const result = analyzeUrl('https://bit.ly/abc123');
    expect(result.flags).toContain('URL scurtat — destinatia reala este ascunsa');
  });

  it('flags suspicious TLDs', () => {
    const result = analyzeUrl('https://ing-bank.xyz');
    expect(result.is_suspicious).toBe(true);
  });

  it('handles invalid URLs', () => {
    const result = analyzeUrl('not a url at all !!!');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags).toContain('URL invalid sau malformat');
  });

  it('flags domains with many digits', () => {
    const result = analyzeUrl('https://login12345.com');
    expect(result.flags).toContain('Domeniu cu multe cifre');
  });

  it('flags too many subdomains', () => {
    const result = analyzeUrl('https://a.b.c.d.example.com');
    expect(result.flags).toContain('Prea multe subdomenii');
  });
});
