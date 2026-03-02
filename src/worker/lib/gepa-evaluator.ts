/**
 * GEPA Evaluator — scores AI-generated content on three dimensions:
 *   1. Romanian readability (sentence length, vocabulary complexity)
 *   2. Factual accuracy (hallucination markers detection)
 *   3. SEO quality (title length, meta description, keyword density)
 *
 * Score range: 0.0–1.0 per dimension + composite (weighted average).
 * Grade: A (>=0.9), B (>=0.75), C (>=0.6), D (>=0.4), F (<0.4)
 */

export interface GepaScore {
  readability: number;
  accuracy: number;
  seo: number;
  composite: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  details: {
    readability: ReadabilityDetails;
    accuracy: AccuracyDetails;
    seo: SeoDetails;
  };
}

export interface ReadabilityDetails {
  avgSentenceWords: number;
  longSentenceRatio: number;
  technicalTermCount: number;
  score: number;
}

export interface AccuracyDetails {
  hallucationMarkerCount: number;
  fabricatedStatCount: number;
  unsourcedPercentageClaimCount: number;
  score: number;
}

export interface SeoDetails {
  titleLength: number;
  titleScore: number;
  metaDescLength: number;
  metaDescScore: number;
  keywordDensity: number;
  keywordScore: number;
  score: number;
}

// Dimension weights for composite score
const WEIGHTS = {
  readability: 0.35,
  accuracy: 0.40,
  seo: 0.25,
};

// Romanian technical/jargon terms that reduce readability for non-technical audiences
const TECHNICAL_TERMS = [
  'malware', 'ransomware', 'exploit', 'payload', 'vector', 'exfiltrate',
  'obfuscat', 'credential', 'keylogger', 'botnet', 'backdoor', 'rootkit',
  'trojan', 'cryptojacking', 'sql injection', 'cross-site', 'xss', 'ddos',
  'man-in-the-middle', 'brute force', 'zero-day', 'vulnerability',
  'penetration testing', 'pentest', 'endpoint', 'firewall', 'proxy',
];

// Phrases that suggest hallucinated / fabricated statistics
const HALLUCINATION_MARKERS = [
  'conform statisticilor', 'studii arată că', 'potrivit datelor',
  'cercetările indică', 'experții spun că', 'datele oficiale arată',
  'rapoartele confirmă', 'analiștii estimează că',
];

// Patterns for unsourced percentage/number claims that may be fabricated
const UNSOURCED_PERCENTAGE_STR = String.raw`\b\d{1,3}(?:[,.]\d{0,2})?\s*%`;
const SOURCED_MARKER_STR = '(estimat|sursa|conform|dnsc|cert-ro|europol|politia|enisa)';

// Optimal SEO title: 50-65 characters
const SEO_TITLE_MIN = 50;
const SEO_TITLE_MAX = 65;
// Optimal meta description: 150-160 characters
const SEO_META_MIN = 150;
const SEO_META_MAX = 160;
// Keyword density target: 1-3%
const SEO_KW_DENSITY_MIN = 0.01;
const SEO_KW_DENSITY_MAX = 0.03;

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function extractMetaDescription(markdown: string): string {
  const match = markdown.match(/META:\s*(.+)/i);
  return match ? match[1].trim() : '';
}

function getSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end of string
  return text
    .split(/[.!?]+(?:\s+|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function getWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zăâîșțА-я\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_]{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/META:.+/gi, '')
    .trim();
}

export function evaluateReadability(content: string): ReadabilityDetails {
  const plain = stripMarkdown(content);
  const sentences = getSentences(plain);
  const words = getWords(plain);

  if (sentences.length === 0 || words.length === 0) {
    return { avgSentenceWords: 0, longSentenceRatio: 0, technicalTermCount: 0, score: 0 };
  }

  // Average words per sentence (target: <=20 for Romanian readability)
  const totalWords = sentences.reduce((acc, s) => acc + getWords(s).length, 0);
  const avgSentenceWords = totalWords / sentences.length;

  // Long sentence ratio (sentences > 25 words)
  const longSentences = sentences.filter(s => getWords(s).length > 25).length;
  const longSentenceRatio = longSentences / sentences.length;

  // Technical term count (lower is better for non-technical audience)
  const fullText = plain.toLowerCase();
  const technicalTermCount = TECHNICAL_TERMS.filter(term => fullText.includes(term)).length;

  // Score calculation
  // avgSentenceWords: ideal <=20 → score 1.0, at 30 → 0.5, at 40+ → 0.0
  const sentenceLengthScore = Math.max(0, Math.min(1, 1 - Math.max(0, avgSentenceWords - 20) / 20));

  // longSentenceRatio: 0 → 1.0, 0.5 → 0.0
  const longSentenceScore = Math.max(0, 1 - longSentenceRatio * 2);

  // technicalTermCount: 0 → 1.0, each term reduces by 0.1
  const techTermScore = Math.max(0, 1 - technicalTermCount * 0.1);

  const score = sentenceLengthScore * 0.45 + longSentenceScore * 0.30 + techTermScore * 0.25;

  return { avgSentenceWords, longSentenceRatio, technicalTermCount, score };
}

export function evaluateAccuracy(content: string): AccuracyDetails {
  const plain = stripMarkdown(content).toLowerCase();

  // Count hallucination marker phrases
  const hallucationMarkerCount = HALLUCINATION_MARKERS.filter(marker =>
    plain.includes(marker.toLowerCase())
  ).length;

  // Find percentage claims (new RegExp to avoid stateful /g flag issues)
  const percentageMatches = content.match(new RegExp(UNSOURCED_PERCENTAGE_STR, 'g')) || [];
  const sourcedMatches = content.match(new RegExp(SOURCED_MARKER_STR, 'gi')) || [];

  // Unsourced percentage claims = percentage claims that don't have a nearby source marker
  // Simple heuristic: if percentages > sourced markers, some are unsourced
  const unsourcedPercentageClaimCount = Math.max(0, percentageMatches.length - sourcedMatches.length);

  // Fabricated stats: very high specific percentages without source (e.g., "847%")
  const fabricatedStatPattern = /\b([1-9]\d{2,})(?:[,.]\d+)?\s*%/g;
  const fabricatedMatches = content.match(fabricatedStatPattern) || [];
  const fabricatedStatCount = fabricatedMatches.length;

  // Score: each hallucination marker = -0.15, each unsourced stat = -0.10, each fabricated = -0.20
  const score = Math.max(0, Math.min(1,
    1
    - hallucationMarkerCount * 0.15
    - unsourcedPercentageClaimCount * 0.10
    - fabricatedStatCount * 0.20
  ));

  return { hallucationMarkerCount, fabricatedStatCount, unsourcedPercentageClaimCount, score };
}

export function evaluateSeo(content: string, keywords: string[] = []): SeoDetails {
  const title = extractTitle(content);
  const metaDesc = extractMetaDescription(content);
  const words = getWords(stripMarkdown(content));

  // Title length score
  const titleLength = title.length;
  let titleScore: number;
  if (titleLength === 0) {
    titleScore = 0;
  } else if (titleLength >= SEO_TITLE_MIN && titleLength <= SEO_TITLE_MAX) {
    titleScore = 1.0;
  } else if (titleLength < SEO_TITLE_MIN) {
    titleScore = titleLength / SEO_TITLE_MIN;
  } else {
    // Over 65 chars: penalize proportionally
    titleScore = Math.max(0, 1 - (titleLength - SEO_TITLE_MAX) / 30);
  }

  // Meta description score
  const metaDescLength = metaDesc.length;
  let metaDescScore: number;
  if (metaDescLength === 0) {
    metaDescScore = 0;
  } else if (metaDescLength >= SEO_META_MIN && metaDescLength <= SEO_META_MAX) {
    metaDescScore = 1.0;
  } else if (metaDescLength < SEO_META_MIN) {
    metaDescScore = metaDescLength / SEO_META_MIN;
  } else {
    metaDescScore = Math.max(0, 1 - (metaDescLength - SEO_META_MAX) / 50);
  }

  // Keyword density score
  let keywordDensity = 0;
  let keywordScore = 0.5; // neutral if no keywords provided

  if (keywords.length > 0 && words.length > 0) {
    const keywordHits = words.filter(w =>
      keywords.some(kw => kw.toLowerCase().split(/\s+/).some(k => w.includes(k)))
    ).length;
    keywordDensity = keywordHits / words.length;

    if (keywordDensity >= SEO_KW_DENSITY_MIN && keywordDensity <= SEO_KW_DENSITY_MAX) {
      keywordScore = 1.0;
    } else if (keywordDensity < SEO_KW_DENSITY_MIN) {
      keywordScore = keywordDensity / SEO_KW_DENSITY_MIN;
    } else {
      // Keyword stuffing: density > 3%
      keywordScore = Math.max(0, 1 - (keywordDensity - SEO_KW_DENSITY_MAX) / 0.05);
    }
  }

  const score = titleScore * 0.40 + metaDescScore * 0.40 + keywordScore * 0.20;

  return { titleLength, titleScore, metaDescLength, metaDescScore, keywordDensity, keywordScore, score };
}

function computeGrade(composite: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (composite >= 0.9) return 'A';
  if (composite >= 0.75) return 'B';
  if (composite >= 0.6) return 'C';
  if (composite >= 0.4) return 'D';
  return 'F';
}

/**
 * Evaluate generated content on readability, accuracy, and SEO.
 * @param content - Markdown content generated by the AI
 * @param keywords - Optional list of target keywords for SEO scoring
 */
export function evaluateContent(content: string, keywords: string[] = []): GepaScore {
  const readabilityDetails = evaluateReadability(content);
  const accuracyDetails = evaluateAccuracy(content);
  const seoDetails = evaluateSeo(content, keywords);

  const composite =
    readabilityDetails.score * WEIGHTS.readability +
    accuracyDetails.score * WEIGHTS.accuracy +
    seoDetails.score * WEIGHTS.seo;

  return {
    readability: readabilityDetails.score,
    accuracy: accuracyDetails.score,
    seo: seoDetails.score,
    composite,
    grade: computeGrade(composite),
    details: {
      readability: readabilityDetails,
      accuracy: accuracyDetails,
      seo: seoDetails,
    },
  };
}
