import type { Env, ReportSignal, EmergingCampaign } from './types';

const REPORT_PREFIX = 'report:';
const CACHE_KEY = 'cache:emerging-campaigns';
const CACHE_TTL = 3600; // 1 hour
const LOOKBACK_DAYS = 7;
const DOMAIN_THRESHOLD = 5;
const SCAM_TYPE_THRESHOLD = 10;
const DEDUP_TTL = 3600; // 1 hour

export async function aggregateSignals(env: Env): Promise<{ emerging: EmergingCampaign[] }> {
  // Check cache first
  const cached = await env.CACHE.get(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as { emerging: EmergingCampaign[] };
    } catch {
      // Corrupted cache entry — fall through to recompute
    }
  }

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  // List all report keys — read signal data from KV metadata (zero individual gets)
  // limit: 1000 guards against unbounded list scans
  const listResult = await env.CACHE.list({ prefix: REPORT_PREFIX, limit: 1000 });
  const signals: ReportSignal[] = [];
  for (const key of listResult.keys) {
    if (key.metadata) {
      const signal = key.metadata as ReportSignal;
      if (signal.timestamp >= cutoff) {
        signals.push(signal);
      }
    }
  }

  // Group by domain
  const domainMap = new Map<string, ReportSignal[]>();
  const scamTypeMap = new Map<string, ReportSignal[]>();

  for (const signal of signals) {
    if (signal.url_domain) {
      const existing = domainMap.get(signal.url_domain) || [];
      existing.push(signal);
      domainMap.set(signal.url_domain, existing);
    }

    const existing = scamTypeMap.get(signal.scam_type) || [];
    existing.push(signal);
    scamTypeMap.set(signal.scam_type, existing);
  }

  const emerging: EmergingCampaign[] = [];
  const addedScamTypes = new Set<string>();

  // Domain clusters
  for (const [domain, reports] of domainMap.entries()) {
    if (reports.length >= DOMAIN_THRESHOLD) {
      const timestamps = reports.map((r) => r.timestamp).sort();
      const scam_type = mostCommon(reports.map((r) => r.scam_type));
      addedScamTypes.add(scam_type);
      emerging.push({
        domain,
        scam_type,
        report_count: reports.length,
        first_seen: new Date(timestamps[0]).toISOString().split('T')[0],
        last_seen: new Date(timestamps[timestamps.length - 1]).toISOString().split('T')[0],
        source: 'community',
        status: 'investigating',
      });
    }
  }

  // Scam type clusters (not already captured by domain)
  for (const [scam_type, reports] of scamTypeMap.entries()) {
    if (reports.length >= SCAM_TYPE_THRESHOLD && !addedScamTypes.has(scam_type)) {
      const timestamps = reports.map((r) => r.timestamp).sort();
      emerging.push({
        scam_type,
        report_count: reports.length,
        first_seen: new Date(timestamps[0]).toISOString().split('T')[0],
        last_seen: new Date(timestamps[timestamps.length - 1]).toISOString().split('T')[0],
        source: 'community',
        status: 'investigating',
      });
    }
  }

  const result = { emerging };
  await env.CACHE.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });

  return result;
}

function mostCommon(arr: string[]): string {
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let best = arr[0];
  let bestCount = 0;
  for (const [item, count] of counts.entries()) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

export async function storeReportSignal(
  env: Env,
  signal: ReportSignal,
  textHash: string,
): Promise<void> {
  const date = new Date(signal.timestamp).toISOString().split('T')[0];

  // Dedup check: skip if same domain+scam_type+date seen within last hour
  if (signal.url_domain) {
    const dedupKey = `dedup:${signal.url_domain}:${signal.scam_type}:${date}`;
    const existing = await env.CACHE.get(dedupKey);
    if (existing) {
      return;
    }
    await env.CACHE.put(dedupKey, '1', { expirationTtl: DEDUP_TTL });
  }

  const key = `${REPORT_PREFIX}${date}:${textHash}`;
  const TTL_30_DAYS = 30 * 24 * 60 * 60;
  await env.CACHE.put(key, '', { expirationTtl: TTL_30_DAYS, metadata: signal });
  // Invalidate aggregation cache so next request recomputes
  await env.CACHE.delete(CACHE_KEY);
}
