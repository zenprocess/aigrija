export interface ScraperSource {
  name: string;
  feedUrl: string;
  type: 'rss' | 'html';
  parseRSS(xml: string): RSSItem[];
  scrapeFullPage(url: string): Promise<CampaignData>;
}

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  slug: string;
  guid?: string;
}

export interface CampaignData {
  title: string;
  slug: string;
  source: string;
  sourceUrl: string;
  publishedAt?: string;
  bodyText?: string;
  threatType?: string;
  affectedBrands?: string[];
  iocs?: string[];
  severity?: string;
}

export interface ScraperRunResult {
  source: string;
  itemsFound: number;
  itemsNew: number;
  errors: string[];
  runAt: string;
}
