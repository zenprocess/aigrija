import { describe, it, expect } from 'vitest';
import { validateVisionResponse, calibrateConfidence } from './vision-validator';

describe('validateVisionResponse', () => {
  it('rejects empty string', () => {
    expect(validateVisionResponse('')).toBe(false);
  });

  it('rejects too-short response', () => {
    expect(validateVisionResponse('Da, suspect.')).toBe(false);
  });

  it('rejects gibberish response', () => {
    expect(validateVisionResponse('xzqwjkplmvbncxzxzqwjkplmvbncxz')).toBe(false);
  });

  it('rejects response with no Romanian markers', () => {
    expect(validateVisionResponse('This is a completely English response with enough length to pass the short check.')).toBe(false);
  });

  it('accepts valid Romanian phishing analysis', () => {
    const response = 'Aceasta este o tentativa de phishing. Mesajul contine un link suspect care imita o banca. Nu accesati link-ul si raportati la DNSC.';
    expect(validateVisionResponse(response)).toBe(true);
  });

  it('accepts valid Romanian safe analysis', () => {
    const response = 'Mesajul este legitim si provine de la o sursa oficiala. Nu sunt semnale de alarma, continutul pare sigur pentru utilizator.';
    expect(validateVisionResponse(response)).toBe(true);
  });

  it('rejects null/undefined cast to string', () => {
    expect(validateVisionResponse(null as unknown as string)).toBe(false);
    expect(validateVisionResponse(undefined as unknown as string)).toBe(false);
  });
});

describe('calibrateConfidence', () => {
  it('returns 0 for empty response', () => {
    expect(calibrateConfidence('', 'phishing')).toBe(0.0);
  });

  it('returns 0 for very short response', () => {
    expect(calibrateConfidence('Da, suspect.', 'suspicious')).toBe(0.0);
  });

  it('returns higher confidence for detailed phishing analysis', () => {
    const detailed = 'Aceasta este o tentativa clara de phishing. Mesajul contine un link fraudulos care imita banca. Se observa frauda prin uzurparea identitatii. Semnale de alarma: URL suspect, limbaj de urgenta, solicitare de date personale. Verdict: phishing confirmat. Recomandare: nu accesati link-ul.';
    const confidence = calibrateConfidence(detailed, 'phishing');
    expect(confidence).toBeGreaterThan(0.5);
  });

  it('returns lower confidence for vague analysis', () => {
    const vague = 'Acest mesaj pare sa fie ceva suspect dar nu sunt sigur. Poate fi o problema.';
    const confidence = calibrateConfidence(vague, 'suspicious');
    expect(confidence).toBeLessThan(0.6);
  });

  it('returns moderate confidence for safe verdict with matching keywords', () => {
    const safe = 'Mesajul este sigur si legitim. Provine de la o sursa oficiala. Nu sunt semnale de alarma detectate in aceasta comunicare.';
    const confidence = calibrateConfidence(safe, 'likely_safe');
    expect(confidence).toBeGreaterThan(0.3);
  });

  it('penalizes contradicting keywords', () => {
    const contradicting = 'Mesajul este sigur si legitim dar contine elemente de phishing si frauda. Este suspect dar oficial.';
    const noContradict = 'Mesajul este sigur si legitim si oficial. Nu sunt probleme sau semnale de alarma in acest mesaj autentic.';
    const confContradicting = calibrateConfidence(contradicting, 'likely_safe');
    const confClean = calibrateConfidence(noContradict, 'likely_safe');
    expect(confClean).toBeGreaterThanOrEqual(confContradicting);
  });

  it('returns value between 0 and 1', () => {
    const responses = [
      'Aceasta este o tentativa de phishing. Mesajul este fraudulos si contine link-uri suspecte care nu sunt de la banca.',
      'Mesajul pare suspect si necesita atentie. Posibil sa fie o escrocherie dar nu sunt sigur.',
      'Mesajul este complet sigur si legitim. Sursa este oficiala si autentificata corect.',
    ];
    const verdicts: Array<'phishing' | 'suspicious' | 'likely_safe'> = ['phishing', 'suspicious', 'likely_safe'];
    for (let i = 0; i < responses.length; i++) {
      const conf = calibrateConfidence(responses[i], verdicts[i]);
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });
});
