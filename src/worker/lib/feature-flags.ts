import type { Env } from './types';

export type FeatureFlag =
  | 'phishtank_enabled'
  | 'vision_enabled'
  | 'gemma_fallback_enabled'
  | 'safe_browsing_enabled';

export async function getFlag(env: Env, flag: FeatureFlag | string, defaultValue: boolean): Promise<boolean> {
  try {
    const value = await env.CACHE.get(`ff:${flag}`);
    if (value === null) return defaultValue;
    return value === '1';
  } catch {
    return defaultValue;
  }
}

export async function setFlag(env: Env, flag: FeatureFlag | string, value: boolean): Promise<void> {
  await env.CACHE.put(`ff:${flag}`, value ? '1' : '0');
}

export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  phishtank_enabled: true,
  vision_enabled: false,
  gemma_fallback_enabled: true,
  safe_browsing_enabled: true,
};
