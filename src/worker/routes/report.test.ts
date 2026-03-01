import { describe, it, expect } from 'vitest';
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
    ADMIN_DB: {} as D1Database,
  } as Env;
}

describe('GET /api/report/:type — zen_labs_credit', () => {
  it('includes zen_labs_credit in response', async () => {
    const { report } = await import('./report');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', report);
    const req = new Request('http://localhost/api/report/raport-dnsc?text=test');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.zen_labs_credit).toBe('ai-grija.ro — Proiect civic Zen Labs');
  });
});
