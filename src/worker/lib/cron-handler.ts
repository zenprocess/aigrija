import type { Env, Campaign } from './types';
import { runScraper } from './scraper-runner';
import { dnscScraper } from './scrapers/dnsc';
import { structuredLog } from './logger';
import { generateMultipleDrafts } from './draft-generator';
import { publishToSanity } from './sanity-writer';

const BATCH_LIMIT = 5;

async function runDraftGeneration(env: Env): Promise<void> {
  structuredLog('info', 'cron_draft_generation_start', { stage: 'cron' });

  const pendingRows = await env.DB.prepare(
    `SELECT * FROM campaigns WHERE draft_status = 'pending' LIMIT ?`
  ).bind(BATCH_LIMIT).all<Campaign>();

  const pending = pendingRows.results ?? [];
  structuredLog('info', 'cron_draft_pending', { stage: 'cron', count: pending.length });

  for (const campaign of pending) {
    try {
      await generateMultipleDrafts(campaign.id, env);
      structuredLog('info', 'cron_draft_generated', { stage: 'cron', campaignId: campaign.id });
    } catch (err) {
      structuredLog('error', 'cron_draft_generation_failed', {
        stage: 'cron',
        campaignId: campaign.id,
        error: String(err),
      });
    }
  }
}

async function runSanityPublish(env: Env): Promise<void> {
  structuredLog('info', 'cron_sanity_publish_start', { stage: 'cron' });

  const generatedRows = await env.DB.prepare(
    `SELECT * FROM campaigns WHERE draft_status = 'generated' LIMIT ?`
  ).bind(BATCH_LIMIT).all<Campaign>();

  const generated = generatedRows.results ?? [];
  structuredLog('info', 'cron_sanity_generated', { stage: 'cron', count: generated.length });

  for (const campaign of generated) {
    if (!campaign.draft_content) {
      structuredLog('warn', 'cron_sanity_no_content', { stage: 'cron', campaignId: campaign.id });
      continue;
    }

    let drafts: { type: string; slug: string; content: string }[] = [];
    try {
      drafts = JSON.parse(campaign.draft_content);
    } catch {
      structuredLog('error', 'cron_sanity_parse_failed', { stage: 'cron', campaignId: campaign.id });
      continue;
    }

    let publishedCount = 0;
    for (const draft of drafts) {
      try {
        await publishToSanity(campaign, draft.content, draft.type, env);
        publishedCount++;
      } catch (err) {
        structuredLog('error', 'cron_sanity_publish_failed', {
          stage: 'cron',
          campaignId: campaign.id,
          type: draft.type,
          error: String(err),
        });
      }
    }

    if (publishedCount > 0) {
      try {
        await env.DB.prepare(
          `UPDATE campaigns SET draft_status = 'published', updated_at = ? WHERE id = ?`
        ).bind(new Date().toISOString(), campaign.id).run();
        structuredLog('info', 'cron_sanity_campaign_published', {
          stage: 'cron',
          campaignId: campaign.id,
          publishedCount,
        });
      } catch (err) {
        structuredLog('error', 'cron_sanity_status_update_failed', {
          stage: 'cron',
          campaignId: campaign.id,
          error: String(err),
        });
      }
    }
  }
}

export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  structuredLog('info', 'cron_start', { stage: 'cron', cron: event.cron });

  if (event.cron === '0 0 * * *') {
    // Midnight daily — run scraper
    const result = await runScraper(dnscScraper, env);
    structuredLog('info', 'cron_scraper_done', {
      stage: 'cron',
      source: result.source,
      itemsFound: result.itemsFound,
      itemsNew: result.itemsNew,
      errorCount: result.errors.length,
    });
    if (result.errors.length > 0) {
      structuredLog('warn', 'cron_scraper_errors', {
        stage: 'cron',
        source: result.source,
        errors: result.errors,
      });
    }
  } else if (event.cron === '0 1 * * *') {
    // 01:00 daily — generate drafts, then publish to Sanity
    await runDraftGeneration(env);
    await runSanityPublish(env);
  } else if (event.cron === '0 6 * * 1') {
    // Monday 06:00 — weekly digest (placeholder)
    structuredLog('info', 'cron_weekly_digest_start', { stage: 'cron' });
    // TODO: wire weekly digest route
  } else {
    structuredLog('warn', 'cron_unknown', { stage: 'cron', cron: event.cron });
  }
}
