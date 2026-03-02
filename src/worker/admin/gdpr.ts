import { Hono } from 'hono';
import type { Env } from '../lib/types';

type AdminEnv = { Bindings: Env };

const CHANNELS = ['tg', 'wa', 'email'] as const;

/**
 * Collect all KV keys matching a user identifier across all channels.
 * Key patterns:
 *   consent:{channel}:{identifier}
 *   {channel}:subscriber:{identifier}
 */
async function collectUserKeys(kv: KVNamespace, identifier: string): Promise<string[]> {
  const keys: string[] = [];

  for (const channel of CHANNELS) {
    const consentKey = `consent:${channel}:${identifier}`;
    const subscriberKey = `${channel}:subscriber:${identifier}`;

    const [consentVal, subscriberVal] = await Promise.all([
      kv.get(consentKey),
      kv.get(subscriberKey),
    ]);

    if (consentVal !== null) keys.push(consentKey);
    if (subscriberVal !== null) keys.push(subscriberKey);
  }

  return keys;
}

export const gdprAdmin = new Hono<AdminEnv>();

/**
 * GET /gdpr/export/:identifier
 * Export all KV data for a user identified by Telegram ID, email, or phone.
 */
gdprAdmin.get('/export/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const keys = await collectUserKeys(c.env.CACHE, identifier);

  const entries: Record<string, unknown> = {};
  await Promise.all(
    keys.map(async (key) => {
      const value = await c.env.CACHE.get(key, 'json');
      entries[key] = value;
    })
  );

  return c.json({
    ok: true,
    identifier,
    count: keys.length,
    data: entries,
  });
});

/**
 * DELETE /gdpr/purge/:identifier
 * Delete all KV entries (consent + subscriber records) for a user.
 */
gdprAdmin.delete('/purge/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const keys = await collectUserKeys(c.env.CACHE, identifier);

  await Promise.all(keys.map((key) => c.env.CACHE.delete(key)));

  return c.json({
    ok: true,
    identifier,
    deleted: keys.length,
  });
});

/**
 * GET /gdpr/consent-log/:identifier
 * Return consent timeline from KV for all channels.
 * Key pattern: consent:{channel}:{identifier}
 */
gdprAdmin.get('/consent-log/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const timeline: Array<{ key: string; channel: string; record: unknown }> = [];

  await Promise.all(
    CHANNELS.map(async (channel) => {
      const key = `consent:${channel}:${identifier}`;
      const record = await c.env.CACHE.get(key, 'json');
      if (record !== null) {
        timeline.push({ key, channel, record });
      }
    })
  );

  timeline.sort((a, b) => a.channel.localeCompare(b.channel));

  return c.json({
    ok: true,
    identifier,
    count: timeline.length,
    timeline,
  });
});
