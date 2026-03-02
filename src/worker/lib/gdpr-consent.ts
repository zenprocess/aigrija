import type { Env } from './types';

export type ConsentChannel = 'tg' | 'wa' | 'email';

const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 60 * 60;
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000; // 365 days (1 year)

export interface ConsentRecord {
  consented_at: string;
  channel: ConsentChannel;
  id: string;
}

export interface SubscriberRecord {
  subscribed_at: string;
  last_active: string;
  channel: ConsentChannel;
  id: string;
}

function consentKey(channel: ConsentChannel, id: string): string {
  return `consent:${channel}:${id}`;
}

function subscriberKey(channel: ConsentChannel, id: string): string {
  return `${channel}:subscriber:${id}`;
}

export async function recordConsent(env: Env, channel: ConsentChannel, id: string): Promise<void> {
  const now = new Date().toISOString();

  const consent: ConsentRecord = { consented_at: now, channel, id };
  await env.CACHE.put(consentKey(channel, id), JSON.stringify(consent), {
    expirationTtl: FIVE_YEARS_SECONDS,
  });

  const existing = await env.CACHE.get<SubscriberRecord>(subscriberKey(channel, id), 'json');
  const subscriber: SubscriberRecord = {
    subscribed_at: existing?.subscribed_at ?? now,
    last_active: now,
    channel,
    id,
  };
  await env.CACHE.put(subscriberKey(channel, id), JSON.stringify(subscriber), {
    expirationTtl: FIVE_YEARS_SECONDS,
  });
}

export async function revokeConsent(env: Env, channel: ConsentChannel, id: string): Promise<void> {
  await env.CACHE.delete(subscriberKey(channel, id));
  await env.CACHE.delete(consentKey(channel, id));
}

export async function isConsentValid(env: Env, channel: ConsentChannel, id: string): Promise<boolean> {
  const value = await env.CACHE.get(consentKey(channel, id));
  return value !== null;
}

export async function updateLastActive(env: Env, channel: ConsentChannel, id: string): Promise<void> {
  const key = subscriberKey(channel, id);
  const existing = await env.CACHE.get<SubscriberRecord>(key, 'json');
  if (!existing) return;

  const updated: SubscriberRecord = { ...existing, last_active: new Date().toISOString() };
  await env.CACHE.put(key, JSON.stringify(updated), { expirationTtl: FIVE_YEARS_SECONDS });
}

export async function purgeInactiveSubscribers(env: Env): Promise<{ purged: number }> {
  const channels: ConsentChannel[] = ['tg', 'wa', 'email'];
  let purged = 0;

  for (const channel of channels) {
    const prefix = `${channel}:subscriber:`;
    let cursor: string | undefined;

    do {
      const result: KVNamespaceListResult<unknown, string> = await env.CACHE.list({
        prefix,
        cursor,
      });

      for (const key of result.keys) {
        const record = await env.CACHE.get<SubscriberRecord>(key.name, 'json');
        if (!record) continue;

        const lastActiveMs = new Date(record.last_active).getTime();
        const inactiveMs = Date.now() - lastActiveMs;

        if (inactiveMs > TWELVE_MONTHS_MS) {
          await env.CACHE.delete(key.name);
          await env.CACHE.delete(consentKey(channel, record.id));
          purged++;
        }
      }

      cursor = result.list_complete ? undefined : (result as { cursor?: string }).cursor;
    } while (cursor);
  }

  return { purged };
}
