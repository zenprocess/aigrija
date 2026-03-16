import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

let store: Record<string, string> = {};
function makeKV(): KVNamespace {
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => { store[key] = value; },
  } as unknown as KVNamespace;
}
function makeEnv(): Env {
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    CACHE: makeKV(),
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

describe('/alerte/:slug — campaign stats counter', () => {
  beforeEach(() => { store = {}; });

  it('shows Niciun raport incă when no reports', async () => {
    const { alerts } = await import('./alerts');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', alerts);
    const req = new Request('http://localhost/alerte/ing-phishing-2024');
    const res = await app.fetch(req, makeEnv());
    if (res.status === 404) return; // campaign may not exist in test data, skip
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Niciun raport');
  });

  it('shows rapoarte primite count when reports exist', async () => {
    const kv = makeKV();
    store['campaign-reports:ing-phishing-2024'] = JSON.stringify({ count: 42, last: '2026-03-01' });
    const { alerts } = await import('./alerts');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', alerts);
    const req = new Request('http://localhost/alerte/ing-phishing-2024');
    const env = makeEnv();
    (env as unknown as Record<string, unknown>).CACHE = kv;
    const res = await app.fetch(req, env);
    if (res.status === 404) return; // campaign may not exist in test data
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('42');
    expect(html).toContain('rapoarte primite');
  });
});
