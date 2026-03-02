import { describe, it, expect } from 'vitest';
import { generateVerdictCard } from '../lib/verdict-card';

describe('generateVerdictCard — Zen Labs credit', () => {
  it('includes Zen Labs credit text in SVG', async () => {
    const svg = await generateVerdictCard({ verdict: 'phishing', riskScore: 0.9 });
    expect(svg).toContain('Verificat de ai-grija.ro | Proiect civic Zen Labs');
  });

  it('includes credit for suspicious verdict', async () => {
    const svg = await generateVerdictCard({ verdict: 'suspicious', riskScore: 0.5 });
    expect(svg).toContain('Proiect civic Zen Labs');
  });

  it('includes credit for likely_safe verdict', async () => {
    const svg = await generateVerdictCard({ verdict: 'likely_safe', riskScore: 0.1 });
    expect(svg).toContain('Proiect civic Zen Labs');
  });
});
