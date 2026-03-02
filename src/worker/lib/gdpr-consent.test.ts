import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordConsent,
  revokeConsent,
  isConsentValid,
  updateLastActive,
  purgeInactiveSubscribers,
  type SubscriberRecord,
} from './gdpr-consent';

// ── Minimal KV mock ──────────────────────────────────────────────────────────

function makeKV() {
  const store = new Map<string, string>();

  return {
    store,
    async put(key: string, value: string, _opts?: unknown) {
      store.set(key, value);
    },
    async get(key: string, type?: string) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix, cursor: _cursor }: { prefix?: string; cursor?: string }) {
      const keys = [...store.keys()]
        .filter(k => (prefix ? k.startsWith(prefix) : true))
        .map(name => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

function makeEnv(kv: ReturnType<typeof makeKV>) {
  return { CACHE: kv } as unknown as import('./types').Env;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('recordConsent', () => {
  it('stores consent and subscriber keys', async () => {
    const kv = makeKV();
    await recordConsent(makeEnv(kv), 'tg', '123');
    expect(kv.store.has('consent:tg:123')).toBe(true);
    expect(kv.store.has('tg:subscriber:123')).toBe(true);
  });

  it('preserves original subscribed_at on repeat calls', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'tg', '123');
    const first = JSON.parse(kv.store.get('tg:subscriber:123')!);
    await recordConsent(env, 'tg', '123');
    const second = JSON.parse(kv.store.get('tg:subscriber:123')!);
    expect(second.subscribed_at).toBe(first.subscribed_at);
  });
});

describe('revokeConsent', () => {
  it('deletes both subscriber and consent keys', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'wa', '447700900000');
    await revokeConsent(env, 'wa', '447700900000');
    expect(kv.store.has('wa:subscriber:447700900000')).toBe(false);
    expect(kv.store.has('consent:wa:447700900000')).toBe(false);
  });

  it('is idempotent when keys do not exist', async () => {
    const kv = makeKV();
    await expect(revokeConsent(makeEnv(kv), 'tg', 'nonexistent')).resolves.toBeUndefined();
  });
});

describe('isConsentValid', () => {
  it('returns true when consent key exists', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'tg', '42');
    expect(await isConsentValid(env, 'tg', '42')).toBe(true);
  });

  it('returns false when consent key is absent', async () => {
    const kv = makeKV();
    expect(await isConsentValid(makeEnv(kv), 'tg', '99')).toBe(false);
  });

  it('returns false after revocation', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'email', 'user@example.com');
    await revokeConsent(env, 'email', 'user@example.com');
    expect(await isConsentValid(env, 'email', 'user@example.com')).toBe(false);
  });
});

describe('updateLastActive', () => {
  it('updates last_active timestamp', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'tg', '555');
    const before = JSON.parse(kv.store.get('tg:subscriber:555')!).last_active as string;

    await new Promise(r => setTimeout(r, 5));
    await updateLastActive(env, 'tg', '555');

    const after = JSON.parse(kv.store.get('tg:subscriber:555')!).last_active as string;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('does nothing when subscriber does not exist', async () => {
    const kv = makeKV();
    await expect(updateLastActive(makeEnv(kv), 'tg', 'ghost')).resolves.toBeUndefined();
  });
});

describe('purgeInactiveSubscribers', () => {
  it('purges subscribers inactive for >12 months', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);

    const thirteenMonthsAgo = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const staleRecord: SubscriberRecord = {
      subscribed_at: thirteenMonthsAgo,
      last_active: thirteenMonthsAgo,
      channel: 'tg',
      id: '777',
    };
    kv.store.set('tg:subscriber:777', JSON.stringify(staleRecord));
    kv.store.set('consent:tg:777', JSON.stringify({ consented_at: thirteenMonthsAgo, channel: 'tg', id: '777' }));

    const result = await purgeInactiveSubscribers(env);
    expect(result.purged).toBe(1);
    expect(kv.store.has('tg:subscriber:777')).toBe(false);
    expect(kv.store.has('consent:tg:777')).toBe(false);
  });

  it('keeps subscribers active within 12 months', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    await recordConsent(env, 'tg', '888');

    const result = await purgeInactiveSubscribers(env);
    expect(result.purged).toBe(0);
    expect(kv.store.has('tg:subscriber:888')).toBe(true);
  });

  it('returns zero when store is empty', async () => {
    const kv = makeKV();
    const result = await purgeInactiveSubscribers(makeEnv(kv));
    expect(result.purged).toBe(0);
  });
});
