/**
 * r2-cleanup.ts — R2 lifecycle cleanup helper (Issue #37)
 *
 * Cloudflare R2 does not natively support lifecycle policies via wrangler.toml.
 * Configure bucket lifecycle via the CF dashboard:
 *   Dashboard → R2 → ai-grija-share-cards → Settings → Object lifecycle rules
 *   → Add rule: expire objects after 30 days
 *
 * This module provides a programmatic fallback that can be invoked from a
 * scheduled cron handler to delete share cards older than 30 days.
 */

import { structuredLog } from './logger';

const DEFAULT_MAX_AGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export interface CleanupResult {
  deleted: number;
  errors: number;
  listed: number;
}

/**
 * Deletes R2 objects in `bucket` that were uploaded more than `maxAgeDays` ago.
 * Iterates using cursor-based pagination to handle large buckets.
 */
export async function deleteOldShareCards(
  bucket: R2Bucket,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
): Promise<CleanupResult> {
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;
  let deleted = 0;
  let errors = 0;
  let listed = 0;
  let cursor: string | undefined;

  do {
    const listOptions: R2ListOptions = { limit: 1000 };
    if (cursor) listOptions.cursor = cursor;

    const result = await bucket.list(listOptions);
    listed += result.objects.length;

    for (const obj of result.objects) {
      // R2 object uploaded time is available via obj.uploaded (Date)
      if (obj.uploaded && obj.uploaded.getTime() < cutoff) {
        try {
          await bucket.delete(obj.key);
          deleted++;
          structuredLog('info', '[r2-cleanup] Deleted old share card', { key: obj.key, uploaded: obj.uploaded.toISOString() });
        } catch (err) {
          errors++;
          structuredLog('error', '[r2-cleanup] Failed to delete object', { key: obj.key, error: String(err) });
        }
      }
    }

    cursor = result.truncated ? (result as R2Objects & { cursor?: string }).cursor : undefined;
  } while (cursor);

  structuredLog('info', '[r2-cleanup] Cleanup complete', { listed, deleted, errors });
  return { deleted, errors, listed };
}
