import type { Env } from './types';
import type { Context, MiddlewareHandler } from 'hono';

// --- Types ---

export type FeatureFlag =
  | 'phishtank_enabled'
  | 'vision_enabled'
  | 'gemma_fallback_enabled'
  | 'safe_browsing_enabled';

export interface FlagValue {
  enabled: boolean;
  /** Percentage of users to enable for (0-100). Applied when enabled is true. */
  percentage?: number;
  /** Cohort identifiers - enable only when context.cohort matches one of these. */
  cohorts?: string[];
}

export interface FlagContext {
  /** User identifier for percentage-based rollout (e.g. IP, user ID, session ID). */
  userId?: string;
  /** Cohort attribute for cohort-based targeting (e.g. "beta-testers"). */
  cohort?: string;
}

// --- Internal helpers ---

const KV_PREFIX = 'ff:';

/**
 * Simple djb2-style hash - returns 0..99 for percentage bucketing.
 * Pure TS, no Node.js crypto needed.
 */
export function hashBucket(flagName: string, userId: string): number {
  const input = `${flagName}:${userId}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

// --- Core API ---

/**
 * Check whether a feature flag is enabled for a given request context.
 * Logic:
 *   1. Flag not in KV -> return defaultValue
 *   2. flag.enabled === false -> return false
 *   3. cohorts set -> check context.cohort membership
 *   4. percentage set -> hash userId into bucket
 *   5. Otherwise -> return flag.enabled
 */
export async function isEnabled(
  env: Env,
  flagName: FeatureFlag | string,
  context?: FlagContext,
  defaultValue = false,
): Promise<boolean> {
  try {
    const raw = await env.CACHE.get(`${KV_PREFIX}${flagName}`);
    if (raw === null) return defaultValue;

    // Legacy boolean format (backwards-compat with existing '1'/'0' values)
    if (raw === '1') return true;
    if (raw === '0') return false;

    const flag: FlagValue = JSON.parse(raw);

    if (!flag.enabled) return false;

    // Cohort targeting takes priority over percentage
    if (flag.cohorts && flag.cohorts.length > 0) {
      return context?.cohort !== undefined && flag.cohorts.includes(context.cohort);
    }

    // Percentage rollout
    if (flag.percentage !== undefined) {
      const userId = context?.userId ?? 'anonymous';
      return hashBucket(flagName, userId) < flag.percentage;
    }

    return true;
  } catch {
    return defaultValue;
  }
}

/** Read the raw FlagValue object from KV (returns null if absent or legacy boolean). */
export async function getFlag(env: Env, flag: FeatureFlag | string, defaultValue: boolean): Promise<boolean> {
  return isEnabled(env, flag, undefined, defaultValue);
}

/** Write a boolean flag (legacy simple format). */
export async function setFlag(env: Env, flag: FeatureFlag | string, value: boolean): Promise<void> {
  await env.CACHE.put(`${KV_PREFIX}${flag}`, value ? '1' : '0');
}

/** Write a rich FlagValue object. */
export async function putFlag(env: Env, flag: string, value: FlagValue): Promise<void> {
  await env.CACHE.put(`${KV_PREFIX}${flag}`, JSON.stringify(value));
}

/** Delete a flag from KV. */
export async function deleteFlag(env: Env, flag: string): Promise<void> {
  await env.CACHE.delete(`${KV_PREFIX}${flag}`);
}

/** List all flags stored in KV (keys with ff: prefix). */
export async function listFlags(env: Env): Promise<{ name: string; value: FlagValue | null; raw: string }[]> {
  const listing = await env.CACHE.list({ prefix: KV_PREFIX });
  const results = await Promise.all(
    listing.keys.map(async (k) => {
      const name = k.name.slice(KV_PREFIX.length);
      const raw = (await env.CACHE.get(k.name)) ?? '';
      let value: FlagValue | null = null;
      try {
        if (raw === '1') value = { enabled: true };
        else if (raw === '0') value = { enabled: false };
        else value = JSON.parse(raw);
      } catch { /* ignore parse errors */ }
      return { name, value, raw };
    }),
  );
  return results;
}

// --- Middleware ---

/**
 * Hono middleware that returns 404 if the named feature flag is disabled.
 * Usage: app.get('/beta-feature', featureGate('vision_enabled'), handler)
 */
export function featureGate(
  flagName: FeatureFlag | string,
  getContext?: (c: Context) => FlagContext,
): MiddlewareHandler {
  return async (c, next) => {
    const ctx = getContext ? getContext(c) : undefined;
    const enabled = await isEnabled(c.env as Env, flagName, ctx);
    if (!enabled) {
      return c.json({ error: 'Not found' }, 404);
    }
    await next();
  };
}

// --- Defaults (legacy) ---

export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  phishtank_enabled: true,
  vision_enabled: false,
  gemma_fallback_enabled: true,
  safe_browsing_enabled: true,
};
