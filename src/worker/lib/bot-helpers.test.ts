import { describe, it, expect } from 'vitest';
import { extractUrls, simpleHash, verdictEmoji, verdictLabel, formatAnalysisReply } from './bot-helpers';

describe('extractUrls', () => {
  it('extracts http and https URLs', () => {
    const text = 'Visit https://example.com and http://test.org for info';
    expect(extractUrls(text)).toEqual(['https://example.com', 'http://test.org']);
  });

  it('extracts www URLs', () => {
    expect(extractUrls('check www.example.com now')).toEqual(['www.example.com']);
  });

  it('returns empty array when no URLs', () => {
    expect(extractUrls('no links here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractUrls('')).toEqual([]);
  });
});

describe('simpleHash', () => {
  it('returns 8-char hex string', () => {
    const hash = simpleHash('hello');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns consistent results', () => {
    expect(simpleHash('test')).toBe(simpleHash('test'));
  });

  it('returns different hashes for different inputs', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('def'));
  });

  it('handles empty string', () => {
    const hash = simpleHash('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('verdictEmoji', () => {
  it('returns red circle for phishing', () => {
    expect(verdictEmoji('phishing')).toBe('\u{1F534}');
  });

  it('returns yellow circle for suspicious', () => {
    expect(verdictEmoji('suspicious')).toBe('\u{1F7E1}');
  });

  it('returns green circle for likely_safe', () => {
    expect(verdictEmoji('likely_safe')).toBe('\u{1F7E2}');
  });

  it('returns green circle for unknown verdict', () => {
    expect(verdictEmoji('unknown')).toBe('\u{1F7E2}');
  });
});

describe('verdictLabel', () => {
  it('returns PHISHING DETECTAT for phishing', () => {
    expect(verdictLabel('phishing')).toBe('PHISHING DETECTAT');
  });

  it('returns MESAJ SUSPECT for suspicious', () => {
    expect(verdictLabel('suspicious')).toBe('MESAJ SUSPECT');
  });

  it('returns PROBABIL SIGUR for likely_safe', () => {
    expect(verdictLabel('likely_safe')).toBe('PROBABIL SIGUR');
  });
});

describe('formatAnalysisReply', () => {
  const baseResult = {
    verdict: 'phishing' as const,
    confidence: 0.95,
    red_flags: ['Suspicious sender'],
    explanation: 'This is a phishing attempt.',
    recommended_actions: ['Do not click links'],
  };

  it('formats HTML reply with bold and italic tags', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'html' });
    expect(reply).toContain('<b>PHISHING DETECTAT</b>');
    expect(reply).toContain('<i>Confidenta: 95%</i>');
    expect(reply).toContain('<b>Explicatie:</b>');
    expect(reply).toContain('This is a phishing attempt.');
  });

  it('formats WhatsApp reply with markdown-style formatting', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'whatsapp' });
    expect(reply).toContain('*PHISHING DETECTAT*');
    expect(reply).toContain('_Confidenta: 95%_');
    expect(reply).toContain('Explicatie:');
    expect(reply).not.toContain('<b>');
  });

  it('includes red flags with HTML bullets', () => {
    const reply = formatAnalysisReply(baseResult, ['[URL] Bad domain'], { format: 'html' });
    expect(reply).toContain('\u2022 Suspicious sender');
    expect(reply).toContain('\u2022 [URL] Bad domain');
  });

  it('includes red flags with dash bullets for WhatsApp', () => {
    const reply = formatAnalysisReply(baseResult, ['[URL] Bad domain'], { format: 'whatsapp' });
    expect(reply).toContain('- Suspicious sender');
    expect(reply).toContain('- [URL] Bad domain');
  });

  it('includes recommended actions', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'html' });
    expect(reply).toContain('1. Do not click links');
  });

  it('includes forwarded message note for WhatsApp', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'whatsapp', isForwarded: true });
    expect(reply).toContain('Mesaj redirec\u021Bionat detectat');
  });

  it('includes card URL for WhatsApp', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'whatsapp', cardUrl: 'https://ai-grija.ro/card/abc' });
    expect(reply).toContain('https://ai-grija.ro/card/abc');
  });

  it('includes footer for HTML format', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'html' });
    expect(reply).toContain('ai-grija.ro');
    expect(reply).toContain('Proiect civic de Zen Labs');
  });

  it('includes footer for WhatsApp format', () => {
    const reply = formatAnalysisReply(baseResult, [], { format: 'whatsapp' });
    expect(reply).toContain('Verifica pe https://ai-grija.ro');
  });

  it('omits red flags section when no flags', () => {
    const result = { ...baseResult, red_flags: [] as string[] };
    const reply = formatAnalysisReply(result, [], { format: 'html' });
    expect(reply).not.toContain('Semne de alarma');
  });

  it('omits actions section when no actions', () => {
    const result = { ...baseResult, recommended_actions: [] as string[] };
    const reply = formatAnalysisReply(result, [], { format: 'html' });
    expect(reply).not.toContain('Actiuni recomandate');
  });
});
