export interface RiskWeights {
  safeBrowsingMatch: number;
  urlhausMatch: number;
  virustotalMalicious: number;
  virustotalSuspicious: number;
  domainAgeLt30: number;
  domainAgeLt90: number;
  httpNoTls: number;
  longDomain: number;
  manyDigits: number;
  tooManySubdomains: number;
  lookalikeBrand: number;
  urlShortener: number;
  suspiciousTld: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = {
  safeBrowsingMatch: 0.5,
  urlhausMatch: 0.5,
  virustotalMalicious: 0.4,
  virustotalSuspicious: 0.2,
  domainAgeLt30: 0.4,
  domainAgeLt90: 0.2,
  httpNoTls: 0.2,
  longDomain: 0.15,
  manyDigits: 0.15,
  tooManySubdomains: 0.1,
  lookalikeBrand: 0.4,
  urlShortener: 0.3,
  suspiciousTld: 0.25,
};

const WEIGHTS_KV_KEY = 'config:risk-weights';
const WEIGHTS_HISTORY_KEY = 'config:risk-weights:history';
const CACHE_TTL_MS = 5 * 60 * 1000;

let _cachedWeights: RiskWeights | null = null;
let _cacheTimestamp = 0;

export async function getWeights(kv: KVNamespace): Promise<RiskWeights> {
  if (_cachedWeights && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedWeights;
  }
  try {
    const raw = await kv.get(WEIGHTS_KV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RiskWeights;
      _cachedWeights = { ...DEFAULT_WEIGHTS, ...parsed };
      _cacheTimestamp = Date.now();
      return _cachedWeights;
    }
  } catch {
    // fall through to defaults
  }
  _cachedWeights = { ...DEFAULT_WEIGHTS };
  _cacheTimestamp = Date.now();
  return _cachedWeights;
}

export async function saveWeights(kv: KVNamespace, weights: RiskWeights): Promise<void> {
  const prev = await getWeights(kv);
  try {
    const histRaw = await kv.get(WEIGHTS_HISTORY_KEY);
    const history: { weights: RiskWeights; savedAt: string }[] = histRaw ? JSON.parse(histRaw) : [];
    history.unshift({ weights: prev, savedAt: new Date().toISOString() });
    const trimmed = history.slice(0, 10);
    await kv.put(WEIGHTS_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore history errors
  }
  await kv.put(WEIGHTS_KV_KEY, JSON.stringify(weights));
  _cachedWeights = null;
  _cacheTimestamp = 0;
}

export async function getWeightHistory(kv: KVNamespace): Promise<{ weights: RiskWeights; savedAt: string }[]> {
  try {
    const raw = await kv.get(WEIGHTS_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as { weights: RiskWeights; savedAt: string }[];
  } catch {
    // ignore
  }
  return [];
}

export function scoreUrlWithWeights(
  weights: RiskWeights,
  flags: {
    safeBrowsingMatch: boolean;
    urlhausMatch: boolean;
    virustotalMalicious: number;
    virustotalSuspicious: number;
    domainAgeDays: number | null;
    httpNoTls: boolean;
    longDomain: boolean;
    manyDigits: boolean;
    tooManySubdomains: boolean;
    lookalikeBrand: boolean;
    urlShortener: boolean;
    suspiciousTld: boolean;
  }
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let score = 0;

  if (flags.safeBrowsingMatch) { breakdown.safeBrowsingMatch = weights.safeBrowsingMatch; score += weights.safeBrowsingMatch; }
  if (flags.urlhausMatch) { breakdown.urlhausMatch = weights.urlhausMatch; score += weights.urlhausMatch; }
  if (flags.virustotalMalicious > 0) { breakdown.virustotalMalicious = weights.virustotalMalicious; score += weights.virustotalMalicious; }
  else if (flags.virustotalSuspicious > 2) { breakdown.virustotalSuspicious = weights.virustotalSuspicious; score += weights.virustotalSuspicious; }
  if (flags.domainAgeDays !== null && flags.domainAgeDays < 30) { breakdown.domainAgeLt30 = weights.domainAgeLt30; score += weights.domainAgeLt30; }
  else if (flags.domainAgeDays !== null && flags.domainAgeDays < 90) { breakdown.domainAgeLt90 = weights.domainAgeLt90; score += weights.domainAgeLt90; }
  if (flags.httpNoTls) { breakdown.httpNoTls = weights.httpNoTls; score += weights.httpNoTls; }
  if (flags.longDomain) { breakdown.longDomain = weights.longDomain; score += weights.longDomain; }
  if (flags.manyDigits) { breakdown.manyDigits = weights.manyDigits; score += weights.manyDigits; }
  if (flags.tooManySubdomains) { breakdown.tooManySubdomains = weights.tooManySubdomains; score += weights.tooManySubdomains; }
  if (flags.lookalikeBrand) { breakdown.lookalikeBrand = weights.lookalikeBrand; score += weights.lookalikeBrand; }
  if (flags.urlShortener) { breakdown.urlShortener = weights.urlShortener; score += weights.urlShortener; }
  if (flags.suspiciousTld) { breakdown.suspiciousTld = weights.suspiciousTld; score += weights.suspiciousTld; }

  return { score: Math.min(score, 1), breakdown };
}
