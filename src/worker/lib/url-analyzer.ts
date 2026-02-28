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
const URL_THREAT_CACHE_TTL_KV = 60; // seconds for KV expirationTtl

interface ThreatCacheEntry {
  safeBrowsing: { match: boolean; threats: string[] };
  urlhaus: { match: boolean; threat?: string };
  virustotal: { match: boolean; stats?: { malicious: number; suspicious: number; harmless: number } };
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
      console.warn('[url-analyzer] Safe Browsing circuit OPEN -- skipping');
    } else {
      console.warn('[url-analyzer] Safe Browsing check failed (graceful degrade):', err);
    }
    return { match: false, threats: [] };
  }
}

async function checkURLhaus(url: string, kv?: KVNamespace): Promise<{ match: boolean; threat?: string }> {
  const doFetch = async () => {
    const formData = new URLSearchParams();
    formData.append('url', url);

    const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) {
      if (res.status >= 500) {
        const e = new Error(`URLhaus API ${res.status}`);
        (e as any).status = res.status;
        throw e;
      }
      console.warn(`[url-analyzer] URLhaus API returned ${res.status}`);
      return { match: false };
    }

    const data = await res.json() as { query_status: string; threat?: string; tags?: string[] };
    if (data.query_status === 'listed') {
      return { match: true, threat: data.threat };
    }
    return { match: false };
  };

  try {
    if (kv) {
      const cb = new CircuitBreaker('urlhaus', kv);
      return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
    }
    return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      console.warn('[url-analyzer] URLhaus circuit OPEN -- skipping');
    } else {
      console.warn('[url-analyzer] URLhaus check failed (graceful degrade):', err);
    }
    return { match: false };
  }
}

async function checkVirusTotal(url: string, apiKey: string, kv?: KVNamespace): Promise<{ match: boolean; stats?: { malicious: number; suspicious: number; harmless: number } }> {
  const doFetch = async () => {
    // base64url encode the URL (no padding)
    const urlId = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      method: 'GET',
      headers: { 'x-apikey': apiKey },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { match: false };
      }
      if (res.status >= 500) {
        const e = new Error(`VirusTotal API ${res.status}`);
        (e as any).status = res.status;
        throw e;
      }
      console.warn(`[url-analyzer] VirusTotal API returned ${res.status}`);
      return { match: false };
    }

    const data = await res.json() as {
      data?: {
        attributes?: {
          last_analysis_stats?: { malicious: number; suspicious: number; harmless: number; undetected: number };
        };
      };
    };

    const statsRaw = data.data?.attributes?.last_analysis_stats;
    if (!statsRaw) return { match: false };

    const stats = {
      malicious: statsRaw.malicious ?? 0,
      suspicious: statsRaw.suspicious ?? 0,
      harmless: statsRaw.harmless ?? 0,
    };

    const match = stats.malicious > 0 || stats.suspicious > 2;
    return { match, stats };
  };

  try {
    if (kv) {
      const cb = new CircuitBreaker('virustotal', kv);
      return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
    }
    return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      console.warn('[url-analyzer] VirusTotal circuit OPEN -- skipping');
    } else {
      console.warn('[url-analyzer] VirusTotal check failed (graceful degrade):', err);
    }
    return { match: false };
  }
}

export async function analyzeUrl(
  url: string,
  safeBrowsingKey?: string,
  virusTotalKey?: string,
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
      urlhaus_match: false,
      virustotal_match: false,
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
      urlhaus_match: false,
      virustotal_match: false,
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
  let urlhausMatch = false;
  let urlhausThreat: string | undefined;
  let virustotalMatch = false;
  let virustotalStats: { malicious: number; suspicious: number; harmless: number } | undefined;

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
          urlhausMatch = entry.urlhaus.match;
          urlhausThreat = entry.urlhaus.threat;
          virustotalMatch = entry.virustotal.match;
          virustotalStats = entry.virustotal.stats;
          usedCache = true;
        }
      }
    } catch {
      // ignore cache read errors
    }
  }

  if (!usedCache) {
    const [sbResult, urlhausResult, vtResult] = await Promise.allSettled([
      safeBrowsingKey ? checkSafeBrowsing(url, safeBrowsingKey, kv) : Promise.resolve(null),
      checkURLhaus(url, kv),
      virusTotalKey ? checkVirusTotal(url, virusTotalKey, kv) : Promise.resolve(null),
    ]);

    if (sbResult.status === 'fulfilled' && sbResult.value) {
      safeBrowsingMatch = sbResult.value.match;
      safeBrowsingThreats = sbResult.value.threats;
    }
    if (urlhausResult.status === 'fulfilled' && urlhausResult.value) {
      urlhausMatch = urlhausResult.value.match;
      urlhausThreat = urlhausResult.value.threat;
    }
    if (vtResult.status === 'fulfilled' && vtResult.value) {
      virustotalMatch = vtResult.value.match;
      virustotalStats = vtResult.value.stats;
    }

    // Store in KV cache with expirationTtl (Finding 2 fix)
    if (kv) {
      const entry: ThreatCacheEntry = {
        safeBrowsing: { match: safeBrowsingMatch, threats: safeBrowsingThreats },
        urlhaus: { match: urlhausMatch, threat: urlhausThreat },
        virustotal: { match: virustotalMatch, stats: virustotalStats },
        cachedAt: Date.now(),
      };
      try {
        await kv.put(cacheKey, JSON.stringify(entry), { expirationTtl: URL_THREAT_CACHE_TTL_KV });
      } catch {
        // ignore cache write errors
      }
    }
  }

  if (safeBrowsingMatch) {
    flagsArr.push(`Detectat de Google Safe Browsing: ${safeBrowsingThreats.join(', ')}`);
    risk += 0.5;
  }
  if (urlhausMatch) {
    flagsArr.push(`Detectat in baza de date URLhaus: ${urlhausThreat ?? 'malware'}`);
    risk += 0.5;
  }
  if (virustotalMatch && virustotalStats) {
    flagsArr.push(`Detectat de VirusTotal: ${virustotalStats.malicious} motoare malitioase, ${virustotalStats.suspicious} suspecte`);
    if (virustotalStats.malicious > 0) {
      risk += 0.4;
    } else {
      risk += 0.2;
    }
  }

  return {
    url,
    domain,
    is_suspicious: risk >= 0.3,
    risk_score: Math.min(risk, 1),
    flags: flagsArr,
    safe_browsing_match: safeBrowsingMatch,
    safe_browsing_threats: safeBrowsingThreats,
    phishtank_match: false,
    urlhaus_match: urlhausMatch,
    urlhaus_threat: urlhausThreat,
    virustotal_match: virustotalMatch,
    virustotal_stats: virustotalStats,
  };
}
