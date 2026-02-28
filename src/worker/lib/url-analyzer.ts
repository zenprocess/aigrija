import { getAllOfficialDomains } from '../data/domains-whitelist';
import type { UrlAnalysisResult } from './types';

const SAFE_BROWSING_THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

async function checkSafeBrowsing(url: string, apiKey: string): Promise<{ match: boolean; threats: string[] }> {
  try {
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
      console.warn(`[url-analyzer] Safe Browsing API returned ${res.status}`);
      return { match: false, threats: [] };
    }

    const data = await res.json() as { matches?: { threatType: string }[] };
    const threats = (data.matches || []).map((m) => m.threatType);
    return { match: threats.length > 0, threats };
  } catch (err) {
    console.warn('[url-analyzer] Safe Browsing check failed (graceful degrade):', err);
    return { match: false, threats: [] };
  }
}


async function checkPhishTank(url: string, apiKey?: string): Promise<{ match: boolean }> {
  try {
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
      console.warn(`[url-analyzer] PhishTank API returned ${res.status}`);
      return { match: false };
    }

    const data = await res.json() as { results?: { in_database: boolean; verified: boolean } };
    const match = !!(data.results?.in_database && data.results?.verified);
    return { match };
  } catch (err) {
    console.warn('[url-analyzer] PhishTank check failed (graceful degrade):', err);
    return { match: false };
  }
}
export async function analyzeUrl(url: string, safeBrowsingKey?: string, phishTankKey?: string): Promise<UrlAnalysisResult> {
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
  const flags: string[] = [];
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

  // Heuristic checks
  if (parsed.protocol === 'http:') { flags.push('Conexiune nesecurizata (HTTP)'); risk += 0.2; }
  if (domain.length > 30) { flags.push('Domeniu neobisnuit de lung'); risk += 0.15; }
  if (/\d{4,}/.test(domain)) { flags.push('Domeniu cu multe cifre'); risk += 0.15; }
  if (domain.split('.').length > 3) { flags.push('Prea multe subdomenii'); risk += 0.1; }

  // Look-alike detection
  const lookalikes = ['ing', 'bcr', 'brd', 'anaf', 'fancourier', 'cnair', 'roviniete'];
  for (const brand of lookalikes) {
    if (domain.includes(brand) && !officialDomains.some(d => domain.endsWith(d))) {
      flags.push(`Posibil domeniu look-alike pentru ${brand}`);
      risk += 0.4;
      break;
    }
  }

  // Shortened URLs
  const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rb.gy'];
  if (shorteners.some(s => domain === s)) { flags.push('URL scurtat — destinatia reala este ascunsa'); risk += 0.3; }

  // Suspicious TLDs
  const suspiciousTlds = ['.xyz', '.top', '.buzz', '.club', '.icu', '.pw', '.tk', '.ml', '.ga', '.cf'];
  if (suspiciousTlds.some(tld => domain.endsWith(tld))) { flags.push('TLD frecvent asociat cu phishing'); risk += 0.25; }

  // Safe Browsing check (async, graceful degrade)
  let safeBrowsingMatch = false;
  let safeBrowsingThreats: string[] = [];
  if (safeBrowsingKey) {
    const sbResult = await checkSafeBrowsing(url, safeBrowsingKey);
    safeBrowsingMatch = sbResult.match;
    safeBrowsingThreats = sbResult.threats;
    if (safeBrowsingMatch) {
      flags.push(`Detectat de Google Safe Browsing: ${safeBrowsingThreats.join(', ')}`);
      risk += 0.5;
    }
  }

  // PhishTank check (async, graceful degrade)
  let phishTankMatch = false;
  {
    const ptResult = await checkPhishTank(url, phishTankKey);
    phishTankMatch = ptResult.match;
    if (phishTankMatch) {
      flags.push('Detectat in baza de date PhishTank ca phishing verificat');
      risk += 0.6;
    }
  }

  return {
    url,
    domain,
    is_suspicious: risk >= 0.3,
    risk_score: Math.min(risk, 1),
    flags,
    safe_browsing_match: safeBrowsingMatch,
    safe_browsing_threats: safeBrowsingThreats,
    phishtank_match: phishTankMatch,
  };
}
