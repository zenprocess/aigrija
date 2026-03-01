import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

// Minimal mock env
function makeEnv(overrides: Partial<Record<string, unknown>> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    CACHE: {
      get: async (key: string) => {
        if (key === 'cards:meta:abc123') {
          return JSON.stringify({ verdict: 'phishing', scam_type: 'bank_impersonation' });
        }
        return null;
      },
      put: async () => {},
    } as unknown as KVNamespace,
    STORAGE: {
      get: async (key: string) => {
        if (key === 'cards/abc123.svg') {
          return { text: async () => '<svg>test</svg>' };
        }
        return null;
      },
    } as unknown as R2Bucket,
    BASE_URL: 'https://ai-grija.ro',
    GOOGLE_SAFE_BROWSING_KEY: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_WEBHOOK_SECRET: '',
    WHATSAPP_VERIFY_TOKEN: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    ADMIN_API_KEY: 'secret',
    ADMIN_DB: {} as D1Database,
    ...overrides,
  } as Env;
}

describe('/card/:hash', () => {
  it('returns HTML with OG meta tags for known hash', async () => {
    const { card } = await import('./card');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', card);

    const req = new Request('http://localhost/card/abc123');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('og:image');
    expect(html).toContain('PHISHING');
    expect(html).toContain('ai-grija.ro');
  });

  it('has share CTA in body', async () => {
    const { card } = await import('./card');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', card);

    const req = new Request('http://localhost/card/abc123');
    const res = await app.fetch(req, makeEnv());
    const html = await res.text();
    expect(html).toContain('mesaj suspect');
  });
});

describe('/card/:hash/image', () => {
  it('returns SVG for known hash', async () => {
    const { card } = await import('./card');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', card);

    const req = new Request('http://localhost/card/abc123/image');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('svg');
  });

  it('returns 404 for unknown hash', async () => {
    const { card } = await import('./card');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', card);

    const req = new Request('http://localhost/card/unknown999/image');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(404);
  });
});
