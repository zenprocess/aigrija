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
    ADMIN_DB: {} as D1Database,
  } as Env;
}

describe('GET /api/stats', () => {
  beforeEach(() => { store = {}; });

  it('returns zero stats when KV is empty', async () => {
    const kv = makeKV();
    const { feed } = await import('./feed');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', feed);
    const res = await app.fetch(new Request('http://localhost/api/stats'), makeEnv(kv));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, number>;
    expect(json.total_checks).toBe(0);
    expect(json.threats_detected).toBe(0);
    expect(json.active_campaigns).toBe(0);
  });

  it('returns correct stats from KV', async () => {
    const kv = makeKV();
    store['stats:total_checks'] = '1234';
    store['stats:threats_detected'] = '56';
    store['stats:active_campaigns'] = '7';
    const { feed } = await import('./feed');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', feed);
    const res = await app.fetch(new Request('http://localhost/api/stats'), makeEnv(kv));
    const json = await res.json() as Record<string, number>;
    expect(json.total_checks).toBe(1234);
    expect(json.threats_detected).toBe(56);
    expect(json.active_campaigns).toBe(7);
  });
});

describe('GET /api/badges', () => {
  it('returns trust badge data', async () => {
    const kv = makeKV();
    const { feed } = await import('./feed');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', feed);
    const res = await app.fetch(new Request('http://localhost/api/badges'), makeEnv(kv));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.verified_by).toBe('Cloudflare Workers AI');
    expect(json.data_sources).toContain('Google Safe Browsing');
    expect(json.certifications).toContain('GDPR Compliant');
  });
});
