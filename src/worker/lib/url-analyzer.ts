import { getAllOfficialDomains } from '../data/domains-whitelist';
import type { UrlAnalysisResult } from './types';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';

const SAFE_BROWSING_THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

const URL_THREAT_CACHE_TTL_MS = 60_000; // 1 minute

interface ThreatCacheEntry {
  safeBrowsing: { match: boolean; threats: string[] };
  phishTank: { match: boolean };
  cachedAt: number;
}

function isRetryableHttpError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout')) return true;
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: number }).status;
    return status >= 500;
  }
  return false;
}

async function checkSafeBrowsing(url: string, apiKey: string, kv?: KVNamespace): Promise<{ match: boolean; threats: string[] }> {
  const doFetch = async () => {
    const body = {
      client: { clientId: 'ai-grija-ro', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: SAFE_BROWSING_THREAT_TYPES,
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    };

    const res = await fetch(
      'https://safebrowsing.googleapis.com/v4/threatMatches:find',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      if (res.status >= 500) {
        const e = new Error(`Safe Browsing API ${res.status}`);
        (e as any).status = res.status;
        throw e;
      }
      console.warn(`[url-analyzer] Safe Browsing API returned ${res.status}`);
      return { match: false, threats: [] };
    }

    const data = await res.json() as { matches?: { threatType: string }[] };
    const threats = (data.matches || []).map((m) => m.threatType);
    return { match: threats.length > 0, threats };
  };

  try {
    if (kv) {
      const cb = new CircuitBreaker('safe-browsing', kv);
      return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
    }
    return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      console.warn('[url-analyzer] Safe Browsing circuit OPEN — skipping');
    } else {
      console.warn('[url-analyzer] Safe Browsing check failed (graceful degrade):', err);
    }
    return { match: false, threats: [] };
  }
}

async function checkPhishTank(url: string, kv?: KVNamespace, apiKey?: string): Promise<{ match: boolean }> {
  const doFetch = async () => {
    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('format', 'json');
    if (apiKey) formData.append('app_key', apiKey);

    const res = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'phishtank/ai-grija-ro' },
      body: formData.toString(),
    });

    if (!res.ok) {
      if (res.status >= 500) {
        const e = new Error(`PhishTank API ${res.status}`);
        (e as any).status = res.status;
        throw e;
      }
      console.warn(`[url-analyzer] PhishTank API returned ${res.status}`);
      return { match: false };
    }

    const data = await res.json() as { results?: { in_database: boolean; verified: boolean } };
    const match = !!(data.results?.in_database && data.results?.verified);
    return { match };
  };

  try {
    if (kv) {
      const cb = new CircuitBreaker('phishtank', kv);
      return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
    }
    return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      console.warn('[url-analyzer] PhishTank circuit OPEN — skipping');
    } else {
      console.warn('[url-analyzer] PhishTank check failed (graceful degrade):', err);
    }
    return { match: false };
  }
}

export async function analyzeUrl(
  url: string,
  safeBrowsingKey?: string,
  phishTankKey?: string,
  kv?: KVNamespace
): Promise<UrlAnalysisResult> {
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return {
      url,
      is_suspicious: true,
      risk_score: 0.7,
      flags: ['URL invalid sau malformat'],
      safe_browsing_match: false,
      safe_browsing_threats: [],
      phishtank_match: false,
    };
  }

  const domain = parsed.hostname.toLowerCase();
  const flagsArr: string[] = [];
  let risk = 0;

  const officialDomains = getAllOfficialDomains();
  if (officialDomains.includes(domain)) {
    return {
      url,
      domain,
      is_suspicious: false,
      risk_score: 0,
      flags: [],
      safe_browsing_match: false,
      safe_browsing_threats: [],
      phishtank_match: false,
    };
  }

  if (parsed.protocol === 'http:') { flagsArr.push('Conexiune nesecurizata (HTTP)'); risk += 0.2; }
  if (domain.length > 30) { flagsArr.push('Domeniu neobisnuit de lung'); risk += 0.15; }
  if (/\d{4,}/.test(domain)) { flagsArr.push('Domeniu cu multe cifre'); risk += 0.15; }
  if (domain.split('.').length > 3) { flagsArr.push('Prea multe subdomenii'); risk += 0.1; }

  const lookalikes = ['ing', 'bcr', 'brd', 'anaf', 'fancourier', 'cnair', 'roviniete'];
  for (const brand of lookalikes) {
    if (domain.includes(brand) && !officialDomains.some(d => domain.endsWith(d))) {
      flagsArr.push(`Posibil domeniu look-alike pentru ${brand}`);
      risk += 0.4;
      break;
    }
  }

  const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rb.gy'];
  if (shorteners.some(s => domain === s)) { flagsArr.push('URL scurtat — destinatia reala este ascunsa'); risk += 0.3; }

  const suspiciousTlds = ['.xyz', '.top', '.buzz', '.club', '.icu', '.pw', '.tk', '.ml', '.ga', '.cf'];
  if (suspiciousTlds.some(tld => domain.endsWith(tld))) { flagsArr.push('TLD frecvent asociat cu phishing'); risk += 0.25; }

  // Check KV cache for external threat results
  let safeBrowsingMatch = false;
  let safeBrowsingThreats: string[] = [];
  let phishTankMatch = false;

  const cacheKey = `url-threat:${domain}`;
  let usedCache = false;

  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        const entry = JSON.parse(cached) as ThreatCacheEntry;
        if (Date.now() - entry.cachedAt < URL_THREAT_CACHE_TTL_MS) {
          safeBrowsingMatch = entry.safeBrowsing.match;
          safeBrowsingThreats = entry.safeBrowsing.threats;
          phishTankMatch = entry.phishTank.match;
          usedCache = true;
        }
      }
    } catch {
      // ignore cache read errors
    }
  }

  if (!usedCache) {
    if (safeBrowsingKey) {
      const sbResult = await checkSafeBrowsing(url, safeBrowsingKey, kv);
      safeBrowsingMatch = sbResult.match;
      safeBrowsingThreats = sbResult.threats;
    }

    const ptResult = await checkPhishTank(url, kv, phishTankKey);
    phishTankMatch = ptResult.match;

    // Store in KV cache
    if (kv) {
      const entry: ThreatCacheEntry = {
        safeBrowsing: { match: safeBrowsingMatch, threats: safeBrowsingThreats },
        phishTank: { match: phishTankMatch },
        cachedAt: Date.now(),
      };
      try {
        await kv.put(cacheKey, JSON.stringify(entry));
      } catch {
        // ignore cache write errors
      }
    }
  }

  if (safeBrowsingMatch) {
    flagsArr.push(`Detectat de Google Safe Browsing: ${safeBrowsingThreats.join(', ')}`);
    risk += 0.5;
  }
  if (phishTankMatch) {
    flagsArr.push('Detectat in baza de date PhishTank ca phishing verificat');
    risk += 0.6;
  }

  return {
    url,
    domain,
    is_suspicious: risk >= 0.3,
    risk_score: Math.min(risk, 1),
    flags: flagsArr,
    safe_browsing_match: safeBrowsingMatch,
    safe_browsing_threats: safeBrowsingThreats,
    phishtank_match: phishTankMatch,
  };
}
