/**
 * Vision output validation and confidence calibration.
 * Catches hallucinated or incoherent vision model responses.
 */

import { isGibberish } from './gibberish-detector';

const ROMANIAN_MARKERS = [
  'este', 'nu', 'sau', 'pentru', 'acest', 'mesaj', 'poate', 'sunt',
  'care', 'din', 'mai', 'fost', 'prin', 'dar', 'cum', 'avea',
  'aceasta', 'suspect', 'phishing', 'frauda', 'escrocherie',
  'legitim', 'sigur', 'atentie', 'posibil', 'oficial',
  'banca', 'cont', 'link', 'date', 'personale',
];

const VERDICT_KEYWORDS: Record<string, string[]> = {
  phishing: ['phishing', 'frauda', 'escrocherie', 'fraudulos', 'fals', 'tentativa'],
  suspicious: ['suspect', 'atentie', 'posibil', 'precautie', 'dubios', 'neclara'],
  likely_safe: ['sigur', 'legitim', 'oficial', 'autentic', 'real', 'valid'],
};

/**
 * Validates a vision model response for basic quality.
 * Rejects responses that are too short, contain no Romanian text, or are gibberish.
 */
export function validateVisionResponse(text: string): boolean {
  if (!text || text.trim().length < 20) {
    return false;
  }

  const gibberishCheck = isGibberish(text);
  if (gibberishCheck.gibberish) {
    return false;
  }

  const lower = text.toLowerCase();
  const hasRomanian = ROMANIAN_MARKERS.some((marker) => lower.includes(marker));
  if (!hasRomanian) {
    return false;
  }

  return true;
}

/**
 * Calibrates confidence based on response quality signals instead of fixed values.
 * Scores keyword density and coherence to produce a 0–1 confidence value.
 */
export function calibrateConfidence(
  response: string,
  verdict: 'phishing' | 'suspicious' | 'likely_safe',
): number {
  if (!response || response.trim().length < 20) {
    return 0.0;
  }

  const lower = response.toLowerCase();
  let score = 0;

  // 1. Keyword density for the detected verdict (0–0.35)
  const verdictWords = VERDICT_KEYWORDS[verdict] || [];
  let keywordHits = 0;
  for (const kw of verdictWords) {
    if (lower.includes(kw)) keywordHits++;
  }
  score += Math.min(keywordHits / verdictWords.length, 1) * 0.35;

  // 2. Response length signal (0–0.20) — longer, more detailed = higher confidence
  const wordCount = response.trim().split(/\s+/).length;
  if (wordCount >= 50) {
    score += 0.20;
  } else if (wordCount >= 25) {
    score += 0.15;
  } else if (wordCount >= 10) {
    score += 0.10;
  }

  // 3. Romanian content density (0–0.20)
  let romanianHits = 0;
  for (const marker of ROMANIAN_MARKERS) {
    if (lower.includes(marker)) romanianHits++;
  }
  const romanianDensity = romanianHits / ROMANIAN_MARKERS.length;
  score += Math.min(romanianDensity * 2, 1) * 0.20;

  // 4. Structural signals (0–0.15) — presence of structured analysis markers
  const structuralMarkers = ['verdict', 'semnale', 'alarma', 'explicatie', 'recomand', 'url', 'link'];
  let structureHits = 0;
  for (const marker of structuralMarkers) {
    if (lower.includes(marker)) structureHits++;
  }
  score += Math.min(structureHits / structuralMarkers.length, 1) * 0.15;

  // 5. Absence of contradictions (0–0.10) — penalize if opposing verdict keywords appear
  const opposingVerdicts = Object.entries(VERDICT_KEYWORDS)
    .filter(([v]) => v !== verdict);
  let contradictions = 0;
  for (const [, words] of opposingVerdicts) {
    for (const kw of words) {
      if (lower.includes(kw)) contradictions++;
    }
  }
  if (contradictions === 0) {
    score += 0.10;
  } else if (contradictions <= 2) {
    score += 0.05;
  }

  return Math.round(score * 100) / 100;
}
