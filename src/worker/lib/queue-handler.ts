/**
 * queue-handler.ts — Report signal aggregation via Cloudflare Queues (Issue #36)
 *
 * Processes batches of ReportSignal messages, aggregates by domain + scam_type,
 * and stores emerging campaign data in KV for review.
 */

import type { Env, ReportSignal, EmergingCampaign } from './types';
import { structuredLog } from './logger';

const EMERGING_CAMPAIGN_THRESHOLD = 3;
const CAMPAIGN_KV_TTL = 7 * 24 * 3600; // 7 days

/** KV key for aggregated signal count */
function signalKey(domain: string, scamType: string): string {
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '_');
  const safeType = scamType.replace(/[^a-z0-9]/gi, '_');
  return `signal:${safeDomain}:${safeType}`;
}

/** KV key for emerging campaign record */
function campaignKey(domain: string, scamType: string): string {
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '_');
  const safeType = scamType.replace(/[^a-z0-9]/gi, '_');
  return `emerging:${safeDomain}:${safeType}`;
}

interface SignalAggregate {
  count: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Handles a batch of report signal queue messages.
 * Aggregates by domain + scam_type and promotes to emerging campaign when threshold is exceeded.
 */
export async function handleReportSignalQueue(
  batch: MessageBatch<ReportSignal>,
  env: Env,
): Promise<void> {
  structuredLog('info', '[queue-handler] Processing report signal batch', { size: batch.messages.length });

  const kv = env.CACHE;
  const now = new Date().toISOString();

  for (const message of batch.messages) {
    const signal = message.body;

    if (!signal.url_domain || !signal.scam_type) {
      structuredLog('warn', '[queue-handler] Skipping signal without domain/scam_type', { signal });
      message.ack();
      continue;
    }

    const domain = signal.url_domain.toLowerCase();
    const scamType = signal.scam_type;

    try {
      const key = signalKey(domain, scamType);
      const raw = await kv.get(key);
      const agg: SignalAggregate = raw
        ? JSON.parse(raw)
        : { count: 0, first_seen: now, last_seen: now };

      agg.count += 1;
      agg.last_seen = now;

      await kv.put(key, JSON.stringify(agg), { expirationTtl: CAMPAIGN_KV_TTL });

      structuredLog('info', '[queue-handler] Signal aggregated', { domain, scamType, count: agg.count });

      // Promote to emerging campaign when threshold is reached
      if (agg.count >= EMERGING_CAMPAIGN_THRESHOLD) {
        const ck = campaignKey(domain, scamType);
        const existing = await kv.get(ck);

        if (!existing) {
          const campaign: EmergingCampaign = {
            domain,
            scam_type: scamType,
            report_count: agg.count,
            first_seen: agg.first_seen,
            last_seen: agg.last_seen,
            source: 'community',
            status: 'investigating',
          };
          await kv.put(ck, JSON.stringify(campaign), { expirationTtl: CAMPAIGN_KV_TTL });
          structuredLog('warn', '[queue-handler] Emerging campaign detected', { domain, scamType, count: agg.count });
        } else {
          // Update existing campaign record
          const campaign = JSON.parse(existing) as EmergingCampaign;
          campaign.report_count = agg.count;
          campaign.last_seen = agg.last_seen;
          await kv.put(ck, JSON.stringify(campaign), { expirationTtl: CAMPAIGN_KV_TTL });
        }
      }

      message.ack();
    } catch (err) {
      structuredLog('error', '[queue-handler] Failed to process signal', { domain, scamType, error: String(err) });
      message.retry();
    }
  }
}
