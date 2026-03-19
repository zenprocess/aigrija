import type { Env, Campaign } from './types';
import { runScraper } from './scraper-runner';
import { dnscScraper } from './scrapers/dnsc';
import { structuredLog } from './logger';
import { generateMultipleDrafts, generateStandalonePost } from './draft-generator';
import { publishToSanity } from './sanity-writer';
import { generateWeeklyDigest, getISOWeek } from './weekly-digest';
import { sendDigestToTelegram } from './telegram-digest';
import { sendDigestEmail } from './email-digest';
import { purgeInactiveSubscribers } from './gdpr-consent';
import { deleteOldShareCards } from './r2-cleanup';

const BATCH_LIMIT = 5;
const JOB_TIMEOUT_MS = 10_000;

function withJobTimeout<T>(promise: Promise<T>, jobName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Job "${jobName}" timed out after ${JOB_TIMEOUT_MS}ms`)),
      JOB_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runDraftGeneration(env: Env): Promise<void> {
  const startTime = Date.now();
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

  structuredLog('info', 'cron_draft_generation_done', { stage: 'cron', job: 'draftGeneration', duration_ms: Date.now() - startTime });
}

async function runSanityPublish(env: Env): Promise<void> {
  const startTime = Date.now();
  structuredLog('info', 'cron_sanity_publish_start', { stage: 'cron' });

  if (!env.SANITY_WRITE_TOKEN) {
    structuredLog('error', 'sanity_write_token_missing', { stage: 'cron', action: 'publish' });
    return;
  }

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

  structuredLog('info', 'cron_sanity_publish_done', { stage: 'cron', job: 'sanityPublish', duration_ms: Date.now() - startTime });
}

async function runWeeklyDigest(env: Env): Promise<void> {
  const startTime = Date.now();
  structuredLog('info', 'cron_weekly_digest_start', { stage: 'cron' });

  const weekOf = getISOWeek(new Date());

  // generateWeeklyDigest handles KV caching internally and returns WeeklyDigest
  let digest;
  try {
    digest = await generateWeeklyDigest(env);
  } catch (err) {
    structuredLog('error', 'cron_weekly_digest_generate_failed', {
      stage: 'cron',
      error: String(err),
    });
    return;
  }

  // Send to Telegram
  try {
    await sendDigestToTelegram(env, digest);
  } catch (err) {
    structuredLog('error', 'cron_weekly_digest_telegram_failed', {
      stage: 'cron',
      error: String(err),
    });
  }

  // Send email to subscribers
  try {
    await sendDigestEmail(env, digest);
  } catch (err) {
    structuredLog('error', 'cron_weekly_digest_email_failed', {
      stage: 'cron',
      error: String(err),
    });
  }

  structuredLog('info', 'cron_weekly_digest_done', { stage: 'cron', job: 'weeklyDigest', weekOf, duration_ms: Date.now() - startTime });
}

export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  structuredLog('info', 'cron_start', { stage: 'cron', cron: event.cron });

  if (event.cron === '0 0 * * *') {
    // Midnight daily — run scraper
    try {
      const result = await withJobTimeout(runScraper(dnscScraper, env), 'dnscScraper');
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
    } catch (err) {
      structuredLog('error', 'cron_scraper_failed', { stage: 'cron', error: String(err) });
    }
  } else if (event.cron === '0 1 * * *') {
    // 01:00 daily — R2 share card cleanup + draft generation + Sanity publish
    try {
      await withJobTimeout(deleteOldShareCards(env.STORAGE), 'r2Cleanup');
      structuredLog('info', 'cron_r2_cleanup_done', { stage: 'cron' });
    } catch (err) {
      structuredLog('error', 'cron_r2_cleanup_failed', { stage: 'cron', error: String(err) });
    }
    try {
      await withJobTimeout(runDraftGeneration(env), 'draftGeneration');
    } catch (err) {
      structuredLog('error', 'cron_draft_generation_unhandled', { stage: 'cron', error: String(err) });
    }
    try {
      await withJobTimeout(runSanityPublish(env), 'sanityPublish');
    } catch (err) {
      structuredLog('error', 'cron_sanity_publish_unhandled', { stage: 'cron', error: String(err) });
    }
  } else if (event.cron === '0 2 * * 1-5') {
    // Weekdays 02:00 — AI educational content generation
    try {
      await withJobTimeout(generateStandalonePost(env), 'contentGeneration');
      structuredLog('info', 'cron_content_generation_done', { stage: 'cron' });
    } catch (err) {
      structuredLog('error', 'cron_content_generation_failed', { stage: 'cron', error: String(err) });
    }
  } else if (event.cron === '0 6 * * 1') {
    // Monday 06:00 — weekly digest distribution
    try {
      await withJobTimeout(runWeeklyDigest(env), 'weeklyDigest');
    } catch (err) {
      structuredLog('error', 'cron_weekly_digest_unhandled', { stage: 'cron', error: String(err) });
    }
  } else if (event.cron === '0 0 1 * *') {
    // First of month — purge inactive subscribers (GDPR)
    try {
      const result = await withJobTimeout(purgeInactiveSubscribers(env), 'gdprPurge');
      structuredLog('info', 'cron_gdpr_purge_done', { stage: 'cron', purged: result.purged });
    } catch (err) {
      structuredLog('error', 'cron_gdpr_purge_failed', { stage: 'cron', error: String(err) });
    }
  } else {
    structuredLog('warn', 'cron_unknown', { stage: 'cron', cron: event.cron });
  }
}
