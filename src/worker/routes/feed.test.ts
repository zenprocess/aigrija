import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { prependFeedEntry, type FeedEntry } from './feed';

let store: Record<string, string> = {};

function makeKV(): KVNamespace {
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => { store[key] = value; },
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace): Env {
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    CACHE: kv,
    STORAGE: {} as R2Bucket,
    BASE_URL: 'https://ai-grija.ro',
    GOOGLE_SAFE_BROWSING_KEY: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_WEBHOOK_SECRET: '',
    WHATSAPP_VERIFY_TOKEN: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    ADMIN_API_KEY: '',
    DB: {} as D1Database,
  } as Env;
}

describe('prependFeedEntry', () => {
  beforeEach(() => { store = {}; });

  it('adds entry to empty feed', async () => {
    const kv = makeKV();
    await prependFeedEntry(kv, { verdict: 'phishing', scam_type: 'bank', timestamp: Date.now() });
    const raw = store['feed:latest'];
    const entries = JSON.parse(raw) as FeedEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0].verdict).toBe('phishing');
  });

  it('prepends entry to existing feed', async () => {
    const kv = makeKV();
    await prependFeedEntry(kv, { verdict: 'suspicious', scam_type: 'sms', timestamp: 1000 });
    await prependFeedEntry(kv, { verdict: 'phishing', scam_type: 'bank', timestamp: 2000 });
    const entries = JSON.parse(store['feed:latest']) as FeedEntry[];
    expect(entries[0].verdict).toBe('phishing');
    expect(entries[1].verdict).toBe('suspicious');
  });

  it('caps feed at 50 entries', async () => {
    const kv = makeKV();
    for (let i = 0; i < 55; i++) {
      await prependFeedEntry(kv, { verdict: 'phishing', scam_type: 'bank', timestamp: i });
    }
    const entries = JSON.parse(store['feed:latest']) as FeedEntry[];
    expect(entries.length).toBe(50);
  });
});

describe('GET /api/feed/latest', () => {
  beforeEach(() => { store = {}; });

  it('returns max 5 entries', async () => {
    const kv = makeKV();
    const allEntries = Array.from({ length: 10 }, (_, i) => ({
      verdict: 'phishing',
      scam_type: 'bank',
      timestamp: Date.now() - i * 1000,
    }));
    store['feed:latest'] = JSON.stringify(allEntries);

    const { feed } = await import('./feed');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', feed);

    const req = new Request('http://localhost/api/feed/latest');
    const res = await app.fetch(req, makeEnv(kv));
    expect(res.status).toBe(200);
    const json = await res.json() as unknown[];
    expect(json.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array when no feed', async () => {
    const kv = makeKV();
    const { feed } = await import('./feed');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', feed);

    const req = new Request('http://localhost/api/feed/latest');
    const res = await app.fetch(req, makeEnv(kv));
    const json = await res.json() as unknown[];
    expect(json).toEqual([]);
  });
});
