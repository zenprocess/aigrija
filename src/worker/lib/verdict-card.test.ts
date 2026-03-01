import { describe, it, expect } from 'vitest';
import { generateVerdictCard, verdictCardHash } from './verdict-card';

describe('generateVerdictCard', () => {
  it('returns SVG string for phishing verdict', async () => {
    const svg = await generateVerdictCard({ verdict: 'phishing', riskScore: 0.95 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('PHISHING DETECTAT');
    expect(svg).toContain('95%');
  });

  it('returns SVG string for suspicious verdict', async () => {
    const svg = await generateVerdictCard({ verdict: 'suspicious', riskScore: 0.6, scamType: 'bank_impersonation' });
    expect(svg).toContain('MESAJ SUSPECT');
    expect(svg).toContain('bank_impersonation');
  });

  it('returns SVG string for likely_safe verdict', async () => {
    const svg = await generateVerdictCard({ verdict: 'likely_safe', riskScore: 0.1, domain: 'ing.ro' });
    expect(svg).toContain('PROBABIL SIGUR');
    expect(svg).toContain('ing.ro');
  });

  it('includes branding', async () => {
    const svg = await generateVerdictCard({ verdict: 'phishing', riskScore: 0.8 });
    expect(svg).toContain('ai-grija.ro');
  });
});

describe('verdictCardHash', () => {
  it('returns consistent hash for same input', () => {
    const h1 = verdictCardHash('test message', 'https://example.com');
    const h2 = verdictCardHash('test message', 'https://example.com');
    expect(h1).toBe(h2);
  });

  it('returns different hash for different input', () => {
    const h1 = verdictCardHash('message1');
    const h2 = verdictCardHash('message2');
    expect(h1).not.toBe(h2);
  });

  it('returns hex string of 8+ chars', () => {
    const h = verdictCardHash('test');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});
