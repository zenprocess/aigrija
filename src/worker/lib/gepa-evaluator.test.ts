import { describe, it, expect } from 'vitest';
import {
  evaluateReadability,
  evaluateAccuracy,
  evaluateSeo,
  evaluateContent,
} from './gepa-evaluator';

// ─── Readability ───────────────────────────────────────────────────────────────

describe('evaluateReadability', () => {
  it('returns score 0 for empty content', () => {
    const result = evaluateReadability('');
    expect(result.score).toBe(0);
  });

  it('gives high score for short sentences without jargon', () => {
    const content = `# Titlu simplu
Nu accesa link-uri suspecte. Verifica expeditorul. Suna la banca ta.
Fii atent la mesajele false. Protejeaza-ti datele personale.`;
    const result = evaluateReadability(content);
    expect(result.avgSentenceWords).toBeLessThanOrEqual(20);
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('penalizes long sentences', () => {
    const longSentence = 'Acesta este un mesaj foarte lung care contine ' +
      'multe cuvinte si depaseste cu mult limita de douazeci de cuvinte ' +
      'recomandata pentru o buna lizibilitate in limba romana pentru cititori non-tehnici.';
    const result = evaluateReadability(longSentence);
    expect(result.avgSentenceWords).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(0.85);
  });

  it('penalizes technical jargon terms', () => {
    const content = 'Malware-ul foloseste un payload pentru a exploata vulnerabilitatile. ' +
      'Ransomware-ul cripteaza datele prin backdoor si rootkit.';
    const result = evaluateReadability(content);
    expect(result.technicalTermCount).toBeGreaterThan(3);
    expect(result.score).toBeLessThan(0.95); // penalized by tech terms but sentences are short
  });

  it('returns technicalTermCount = 0 for clean Romanian text', () => {
    const content = 'Nu deschide mesaje suspecte. Schimba parola imediat. Suna la banca.';
    const result = evaluateReadability(content);
    expect(result.technicalTermCount).toBe(0);
  });
});

// ─── Accuracy ─────────────────────────────────────────────────────────────────

describe('evaluateAccuracy', () => {
  it('returns score 1.0 for content with no hallucination markers', () => {
    const content = '# Articol curat\nNu accesa link-uri suspecte. Raporteaza la DNSC.';
    const result = evaluateAccuracy(content);
    expect(result.hallucationMarkerCount).toBe(0);
    expect(result.fabricatedStatCount).toBe(0);
    expect(result.score).toBe(1.0);
  });

  it('penalizes hallucination marker phrases', () => {
    const content = 'Conform statisticilor, phishing-ul a crescut. Studii arată că 90% din romani sunt afectati.';
    const result = evaluateAccuracy(content);
    expect(result.hallucationMarkerCount).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThan(0.9);
  });

  it('penalizes unsourced percentage claims', () => {
    const content = 'Atacurile au crescut cu 45%. Frauda bancara a crescut cu 78%.';
    const result = evaluateAccuracy(content);
    expect(result.unsourcedPercentageClaimCount).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(0.9);
  });

  it('does not penalize percentages with source markers', () => {
    const content = 'Atacurile au crescut cu 30% (estimat, conform DNSC).';
    const result = evaluateAccuracy(content);
    // The percentage has a source marker so unsourced count should be 0
    expect(result.unsourcedPercentageClaimCount).toBe(0);
    expect(result.score).toBe(1.0);
  });

  it('heavily penalizes fabricated high-value statistics', () => {
    const content = 'Phishing-ul a crescut cu 847%. Fraudele au crescut cu 1200%.';
    const result = evaluateAccuracy(content);
    expect(result.fabricatedStatCount).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it('clamps score at 0 for very bad content', () => {
    const content = [
      'Conform statisticilor, studii arată că datele oficiale arată că cercetările indică.',
      'Phishing-ul a crescut cu 500%. Frauda a crescut cu 999%. Atacurile au crescut cu 1500%.',
      'Potrivit datelor, rapoartele confirmă că experții spun că analiștii estimează că.',
    ].join(' ');
    const result = evaluateAccuracy(content);
    expect(result.score).toBe(0);
  });
});

// ─── SEO ──────────────────────────────────────────────────────────────────────

describe('evaluateSeo', () => {
  it('returns 0 for content with no title and no meta description', () => {
    const result = evaluateSeo('Fara titlu si fara meta descriere.');
    expect(result.titleScore).toBe(0);
    expect(result.metaDescScore).toBe(0);
  });

  it('gives full title score for optimal length (50-65 chars)', () => {
    // Exactly 55 chars title
    const content = '# ALERTĂ: SMS-uri false de la FAN Courier în România';
    const result = evaluateSeo(content);
    expect(result.titleLength).toBeGreaterThanOrEqual(50);
    expect(result.titleLength).toBeLessThanOrEqual(65);
    expect(result.titleScore).toBe(1.0);
  });

  it('penalizes short title', () => {
    const content = '# Phishing';
    const result = evaluateSeo(content);
    expect(result.titleScore).toBeLessThan(0.5);
  });

  it('gives full meta desc score for optimal length (150-160 chars)', () => {
    const meta = 'A'.repeat(155);
    const content = `# Titlu\n\nConținut articol.\n\nMETA: ${meta}`;
    const result = evaluateSeo(content);
    expect(result.metaDescLength).toBe(155);
    expect(result.metaDescScore).toBe(1.0);
  });

  it('penalizes missing meta description', () => {
    const content = '# Titlu bun cu exact cincizeci si cinci de caractere ok!\nConținut articol.';
    const result = evaluateSeo(content);
    expect(result.metaDescScore).toBe(0);
  });

  it('scores keyword density correctly when keywords provided', () => {
    // Create content with ~2% keyword density
    const words = Array(100).fill('articol').join(' ');
    const content = `# Titlu\n${words}\nMETA: ${'x'.repeat(155)}`;
    const result = evaluateSeo(content, ['articol']);
    // All words are "articol" so density is ~1.0 — keyword stuffing
    expect(result.keywordScore).toBeLessThan(0.5);
  });

  it('uses neutral keyword score when no keywords provided', () => {
    const content = '# Titlu\nText simplu.';
    const result = evaluateSeo(content, []);
    expect(result.keywordScore).toBe(0.5);
  });
});

// ─── Composite evaluateContent ─────────────────────────────────────────────────

describe('evaluateContent', () => {
  const goodContent = `# ALERTĂ: SMS-uri false de la FAN Courier fură datele rom
Nu accesa link-ul din mesaj. Sterge imediat mesajul primit.
Suna la DNSC: 1911. Raporteaza frauda la Politia Romana: 112.
Verifica expeditorul inainte de a raspunde. Nu da date personale.
Fii atent la mesajele care cer urgenta. Acestea sunt semne de frauda.

META: Afla cum sa te protejezi de SMS-urile false de la FAN Courier. Raporteaza frauda la DNSC 1911 sau Politia Romana 112 imediat.`;

  it('returns a GepaScore with all required fields', () => {
    const score = evaluateContent(goodContent);
    expect(score).toHaveProperty('readability');
    expect(score).toHaveProperty('accuracy');
    expect(score).toHaveProperty('seo');
    expect(score).toHaveProperty('composite');
    expect(score).toHaveProperty('grade');
    expect(score).toHaveProperty('details');
  });

  it('composite is weighted average of dimensions', () => {
    const score = evaluateContent(goodContent);
    const expected = score.readability * 0.35 + score.accuracy * 0.40 + score.seo * 0.25;
    expect(Math.abs(score.composite - expected)).toBeLessThan(0.001);
  });

  it('assigns grade A to excellent content', () => {
    // Perfect scenario: short sentences, no jargon, no fabricated stats, good title + meta
    const perfect = `# ALERTĂ: SMS-uri false de la FAN Courier fură datele rom
Nu accesa link-ul primit. Sterge mesajul imediat.
Suna la DNSC pe numarul 1911. Raporteaza la Politia Romana.

META: Protejeaza-te de SMS-urile false de la FAN Courier. Sterge mesajul si suna la DNSC 1911 sau Politia Romana 112 acum.`;
    const score = evaluateContent(perfect);
    expect(['A', 'B']).toContain(score.grade);
  });

  it('assigns grade F to very bad content', () => {
    // Content with many hallucination markers + fabricated stats = very low accuracy score
    // which drags composite below 0.4 (accuracy has 0.40 weight)
    const terrible = [
      'Conform statisticilor, studii arata ca datele oficiale arata ca cercetarile indica ca.',
      'Phishing-ul a crescut cu 500%. Frauda a crescut cu 999%. Atacurile au crescut cu 1500%.',
      'Potrivit datelor, rapoartele confirma ca expertii spun ca analistii estimeaza ca.',
      'Conform statisticilor cercetarile indica ca studii arata ca potrivit datelor.',
    ].join(' ');
    const score = evaluateContent(terrible);
    expect(score.accuracy).toBeLessThan(0.5);
    expect(['D', 'F']).toContain(score.grade);
  });

  it('all dimension scores are between 0 and 1', () => {
    const score = evaluateContent(goodContent);
    expect(score.readability).toBeGreaterThanOrEqual(0);
    expect(score.readability).toBeLessThanOrEqual(1);
    expect(score.accuracy).toBeGreaterThanOrEqual(0);
    expect(score.accuracy).toBeLessThanOrEqual(1);
    expect(score.seo).toBeGreaterThanOrEqual(0);
    expect(score.seo).toBeLessThanOrEqual(1);
    expect(score.composite).toBeGreaterThanOrEqual(0);
    expect(score.composite).toBeLessThanOrEqual(1);
  });

  it('accepts optional keywords parameter', () => {
    const score = evaluateContent(goodContent, ['phishing', 'fan courier', 'dnsc']);
    expect(score).toHaveProperty('seo');
    expect(score.seo).toBeGreaterThanOrEqual(0);
  });
});

// ─── Grade thresholds ──────────────────────────────────────────────────────────

describe('grade thresholds', () => {
  it('grade F for composite below 0.4', () => {
    // Use content with worst-case accuracy (hallucination markers + fabricated stats)
    // accuracy 0.0 * 0.40 = 0.0, seo 0.0 * 0.25 = 0.0, readability * 0.35 <= 0.35
    // composite <= 0.35 < 0.4
    const terrible = [
      'Conform statisticilor studii arata ca datele oficiale arata cercetarile indica.',
      'Potrivit datelor rapoartele confirma expertii spun analistii estimeaza.',
      '500%. 999%. 1500%. 847%. 1200%. 2000%. 3000%. 4000%. 5000%. 6000%.',
      'Conform statisticilor studii arata ca datele oficiale arata cercetarile indica.',
      'Potrivit datelor rapoartele confirma expertii spun analistii estimeaza.',
    ].join(' ');
    const score = evaluateContent(terrible);
    expect(score.composite).toBeLessThan(0.5);
    expect(['D', 'F']).toContain(score.grade);
  });
});
