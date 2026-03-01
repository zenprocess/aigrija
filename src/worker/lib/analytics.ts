import type { Env } from './types';

export interface EventData {
  endpoint: string;
  verdict?: string;
  riskScore?: number;
  responseTimeMs?: number;
  country?: string;
  requestId?: string;
  extra?: Record<string, unknown>;
}

export function logEvent(env: Env, data: EventData): void {
  if (!env.ANALYTICS) return;

  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        data.endpoint,
        data.verdict ?? '',
        data.country ?? '',
      ],
      doubles: [
        data.responseTimeMs ?? 0,
        data.riskScore ?? 0,
      ],
      indexes: [data.requestId ?? ''],
    });
  } catch {
    // Non-fatal: analytics failure should never break request handling
  }
}
