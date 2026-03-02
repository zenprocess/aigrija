import { describe, it, expect, vi } from 'vitest';
import { generateVerdictCard, verdictCardHash } from '../lib/verdict-card';

describe('verdict card generation for share flow', () => {
  it('generateVerdictCard returns valid SVG for phishing', async () => {
    const svg = await generateVerdictCard({ verdict: 'phishing', riskScore: 0.9, scamType: 'bank_impersonation' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('PHISHING DETECTAT');
  });

  it('verdictCardHash is deterministic for same input', () => {
    const h1 = verdictCardHash('test-message', 'https://example.com');
    const h2 = verdictCardHash('test-message', 'https://example.com');
    expect(h1).toBe(h2);
  });

  it('verdictCardHash differs for different inputs', () => {
    const h1 = verdictCardHash('msg1');
    const h2 = verdictCardHash('msg2');
    expect(h1).not.toBe(h2);
  });

  it('card hash is a hex string', () => {
    const h = verdictCardHash('some message content');
    expect(h).toMatch(/^[0-9a-f]+$/);
  });
});

describe('R2 card key structure', () => {
  it('card key follows cards/{hash}.svg pattern', () => {
    const hash = verdictCardHash('test message');
    const r2Key = `cards/${hash}.svg`;
    expect(r2Key).toMatch(/^cards\/[0-9a-f]+\.svg$/);
  });

  it('share URL follows /card/{hash} pattern', () => {
    const hash = verdictCardHash('test message');
    const baseUrl = 'https://ai-grija.ro';
    const shareUrl = `${baseUrl}/card/${hash}`;
    expect(shareUrl).toMatch(/^https:\/\/ai-grija\.ro\/card\/[0-9a-f]+$/);
  });
});
