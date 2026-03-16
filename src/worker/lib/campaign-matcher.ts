import { CAMPAIGNS, type Campaign } from '../data/campaigns';

export interface CampaignMatch {
  campaign: Campaign;
  score: number;
  matched_patterns: string[];
}

export function matchCampaigns(text: string, url?: string): CampaignMatch[] {
  const lower = text.toLowerCase();
  const urlLower = url?.toLowerCase() || '';
  const matches: CampaignMatch[] = [];

  for (const campaign of CAMPAIGNS) {
    const matched: string[] = [];
    let score = 0;

    for (const pattern of campaign.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        matched.push(pattern);
        score += 1;
      }
    }

    if (url) {
      for (const pattern of campaign.url_patterns) {
        if (urlLower.includes(pattern.toLowerCase())) {
          matched.push(`[url] ${pattern}`);
          score += 2;
        }
      }
    }

    if (score > 0) {
      matches.push({ campaign, score, matched_patterns: matched });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// D1-backed campaign matching
// ---------------------------------------------------------------------------

const DB_CAMPAIGNS_CACHE_KEY = 'campaigns:db:cache';
const DB_CAMPAIGNS_CACHE_TTL = 3600; // 1 hour

interface DbCampaignCacheEntry {
  id: string;
  slug: string;
  title: string;
  affected_brands: string[];
  keywords: string[]; // extracted from title + body_text
}

export interface DbCampaignMatch {
  campaign_id: string;
  campaign_name: string;
  slug: string;
  score: number;
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;:.()\[\]{}"']+/)
    .filter(w => w.length > 3 && /^[\p{L}]+$/u.test(w))
    .slice(0, 20);
}

async function getDbCampaigns(
  db: D1Database,
  cache: KVNamespace,
): Promise<DbCampaignCacheEntry[]> {
  const cached = await cache.get(DB_CAMPAIGNS_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as DbCampaignCacheEntry[];
    } catch {
      // cache corrupt, fall through to DB
    }
  }

  try {
    const result = await db
      .prepare(
        `SELECT id, slug, title, body_text, affected_brands
         FROM campaigns
         WHERE archived = 0
         ORDER BY created_at DESC
         LIMIT 200`,
      )
      .all<{
        id: string;
        slug: string;
        title: string;
        body_text: string | null;
        affected_brands: string;
      }>();

    const entries: DbCampaignCacheEntry[] = result.results.map(row => {
      let brands: string[] = [];
      try {
        brands = JSON.parse(row.affected_brands || '[]');
      } catch {
        brands = [];
      }

      const titleKeywords = extractKeywords(row.title);
      const bodyKeywords = row.body_text ? extractKeywords(row.body_text).slice(0, 10) : [];
      const keywords = [...new Set([...brands.map(b => b.toLowerCase()), ...titleKeywords, ...bodyKeywords])];

      return { id: row.id, slug: row.slug, title: row.title, affected_brands: brands, keywords };
    });

    await cache.put(DB_CAMPAIGNS_CACHE_KEY, JSON.stringify(entries), {
      expirationTtl: DB_CAMPAIGNS_CACHE_TTL,
    });

    return entries;
  } catch {
    // D1 unavailable — static campaigns serve as fallback
    return [];
  }
}

export async function matchCampaignsFromDB(
  text: string,
  url: string | undefined,
  db: D1Database,
  cache: KVNamespace,
): Promise<DbCampaignMatch[]> {
  const campaigns = await getDbCampaigns(db, cache);
  const lower = text.toLowerCase();
  const urlLower = url?.toLowerCase() || '';
  const matches: DbCampaignMatch[] = [];

  for (const campaign of campaigns) {
    let score = 0;

    for (const keyword of campaign.keywords) {
      if (keyword.length > 3 && lower.includes(keyword)) {
        score += 1;
      }
    }

    if (url) {
      for (const brand of campaign.affected_brands) {
        if (urlLower.includes(brand.toLowerCase())) {
          score += 2;
        }
      }
    }

    if (score > 0) {
      matches.push({ campaign_id: campaign.id, campaign_name: campaign.title, slug: campaign.slug, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
