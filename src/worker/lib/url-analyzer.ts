import { getAllOfficialDomains } from '../data/domains-whitelist';
import type { UrlAnalysisResult } from './types';

export function analyzeUrl(url: string): UrlAnalysisResult {
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return { url, is_suspicious: true, risk_score: 0.7, flags: ['URL invalid sau malformat'] };
  }

  const domain = parsed.hostname.toLowerCase();
  const flags: string[] = [];
  let risk = 0;

  const officialDomains = getAllOfficialDomains();
  if (officialDomains.includes(domain)) {
    return { url, domain, is_suspicious: false, risk_score: 0, flags: [] };
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

  return { url, domain, is_suspicious: risk >= 0.3, risk_score: Math.min(risk, 1), flags };
}
