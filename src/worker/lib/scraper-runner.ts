import type { Env } from './types';
import type { ScraperSource, ScraperRunResult, CampaignData } from './scraper';
import { structuredLog } from './logger';

export async function runScraper(source: ScraperSource, env: Env): Promise<ScraperRunResult> {
  const runAt = new Date().toISOString();
  const errors: string[] = [];
  let itemsFound = 0;
  let itemsNew = 0;

  // Fetch RSS feed
  let rssXml: string;
  try {
    const resp = await fetch(source.feedUrl, {
      headers: { 'User-Agent': 'ai-grija-bot/1.0 (+https://ai-grija.ro/bot)' },
    });
    if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);
    rssXml = await resp.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`RSS fetch error: ${msg}`);
    await logRun(env, source.name, 0, 0, errors, runAt);
    return { source: source.name, itemsFound: 0, itemsNew: 0, errors, runAt };
  }

  const items = source.parseRSS(rssXml);
  itemsFound = items.length;

  structuredLog('info', 'scraper_rss_parsed', { source: source.name, count: items.length });

  for (const item of items) {
    const seenKey = `scraper:${source.name}:seen:${item.slug}`;

    // Deduplication check
    const alreadySeen = await env.CACHE.get(seenKey);
    if (alreadySeen) continue;

    // Scrape full page
    let data: CampaignData;
    try {
      data = await source.scrapeFullPage(item.link);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Scrape error for ${item.slug}: ${msg}`);
      continue;
    }

    // Insert into D1
    let campaignId: string | null = null;
    try {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO campaigns
          (id, title, slug, source, source_url, published_at, body_text, threat_type,
           affected_brands, iocs, severity, draft_status, archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`
      ).bind(
        id,
        data.title,
        data.slug,
        data.source,
        data.sourceUrl,
        data.publishedAt ?? null,
        data.bodyText ?? null,
        data.threatType ?? null,
        data.affectedBrands ? JSON.stringify(data.affectedBrands) : null,
        data.iocs ? JSON.stringify(data.iocs) : null,
        data.severity ?? null,
        new Date().toISOString()
      ).run();
      campaignId = id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`D1 insert error for ${item.slug}: ${msg}`);
      continue;
    }

    // Mark as seen in KV (30-day TTL)
    await env.CACHE.put(seenKey, '1', { expirationTtl: 60 * 60 * 24 * 30 });

    // Enqueue to DRAFT_QUEUE for AI generation
    if (env.DRAFT_QUEUE && campaignId) {
      try {
        await env.DRAFT_QUEUE.send({ campaignId, source: source.name });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        structuredLog('warn', 'draft_queue_enqueue_failed', { campaignId, error: msg });
      }
    }

    itemsNew++;
    structuredLog('info', 'scraper_item_imported', { source: source.name, slug: item.slug, campaignId });
  }

  await logRun(env, source.name, itemsFound, itemsNew, errors, runAt);

  return { source: source.name, itemsFound, itemsNew, errors, runAt };
}

async function logRun(
  env: Env,
  sourceName: string,
  itemsFound: number,
  itemsNew: number,
  errors: string[],
  runAt: string
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO scraper_runs (id, source, items_found, items_new, errors, run_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      sourceName,
      itemsFound,
      itemsNew,
      errors.length ? JSON.stringify(errors) : null,
      runAt
    ).run();
  } catch (err) {
    structuredLog('warn', 'scraper_run_log_failed', { source: sourceName, error: String(err) });
  }
}
