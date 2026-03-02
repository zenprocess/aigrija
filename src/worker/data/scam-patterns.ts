export interface ScamPattern {
  name: string;
  category: 'courier' | 'tax' | 'marketplace' | 'bank' | 'utility';
  domains: string[];
  keywords: string[];
  description: string;
}

export const SCAM_PATTERNS: ScamPattern[] = [
  {
    name: 'Posta Romana',
    category: 'courier',
    domains: ['postaromana', 'posta-romana', 'colet-ro'],
    keywords: ['coletul dvs', 'taxa vamala', '1.63 eur', 'confirmare livrare'],
    description: 'Phishing care imită Poșta Română — taxe vamale false sau confirmare livrare colet',
  },
  {
    name: 'ANAF',
    category: 'tax',
    domains: ['anaf', 'finante-romania', 'e-guvernare'],
    keywords: ['restituire taxa', 'declaratie fiscala', 'cont fiscal'],
    description: 'Phishing care imită ANAF — restituiri de taxe sau declarații fiscale false',
  },
  {
    name: 'OLX',
    category: 'marketplace',
    domains: ['olx-plata', 'olx-pay', 'olx-confirm'],
    keywords: ['plata confirmata', 'ridicati banii', 'link de plata'],
    description: 'Phishing care imită OLX — linkuri de plată false sau confirmare tranzacție',
  },
  {
    name: 'Curier (FAN/DPD/Sameday)',
    category: 'courier',
    domains: ['fancourier', 'dpd-ro', 'sameday'],
    keywords: ['colet in asteptare', 'confirmare livrare', 'taxa curier'],
    description: 'Phishing care imită curieri (FAN Courier, DPD, Sameday) — taxe sau confirmare livrare false',
  },
  {
    name: 'SMS Bancar',
    category: 'bank',
    domains: [],
    keywords: ['contul dvs a fost blocat', 'tranzactie suspecta', 'verificare identitate', 'actualiza datele'],
    description: 'SMS fals de la o bancă — blocare cont, tranzacție suspectă sau solicitare actualizare date',
  },
];

export interface ScamPatternMatch {
  name: string;
  category: ScamPattern['category'];
  description: string;
}

export function matchScamPattern(text: string, url?: string): ScamPatternMatch | null {
  const textLower = text.toLowerCase();
  const urlLower = url ? url.toLowerCase() : '';

  for (const pattern of SCAM_PATTERNS) {
    // Check domain patterns against URL
    const domainMatch = pattern.domains.some((d) => urlLower.includes(d));

    // Check keyword patterns against message text
    const keywordMatch = pattern.keywords.some((kw) => textLower.includes(kw.toLowerCase()));

    if (domainMatch || keywordMatch) {
      return {
        name: pattern.name,
        category: pattern.category,
        description: pattern.description,
      };
    }
  }

  return null;
}
