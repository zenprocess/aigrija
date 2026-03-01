import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

const mockFetch = vi.fn().mockResolvedValue(new Response('{"messages":[{"id":"mid1"}]}'));
vi.stubGlobal('fetch', mockFetch);

vi.mock('../lib/classifier', () => ({
  classify: vi.fn().mockResolvedValue({
    verdict: 'phishing',
    confidence: 0.95,
    scam_type: 'bank_impersonation',
    red_flags: ['urgenta'],
    explanation: 'Mesaj phishing.',
    recommended_actions: ['Nu accesati linkul'],
  }),
}));

vi.mock('../lib/url-analyzer', () => ({
  analyzeUrl: vi.fn().mockResolvedValue({ is_suspicious: false, flags: [] }),
}));

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
    WHATSAPP_VERIFY_TOKEN: 'test-token',
    WHATSAPP_ACCESS_TOKEN: 'wa-token',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    ADMIN_API_KEY: '',
    ADMIN_DB: {} as D1Database,
    WHATSAPP_APP_SECRET: '',
  } as unknown as Env;
}

function makeWABody(messageOverrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'entry1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '1234', phone_number_id: 'phone-id' },
          contacts: [{ profile: { name: 'Test' }, wa_id: '40700000000' }],
          messages: [{
            from: '40700000000',
            id: 'msg1',
            timestamp: '1234567890',
            type: 'text',
            text: { body: 'Contul dvs va fi blocat. Click: http://ing-fals.com' },
            ...messageOverrides,
          }],
        },
      }],
    }],
  };
}

describe('WhatsApp — forwarded message detection', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; });

  it('detects forwarded message via context.forwarded flag', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);

    const body = makeWABody({ context: { forwarded: true } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    // Should have called fetch (markRead + sendInteractive)
    expect(mockFetch).toHaveBeenCalled();
    // One of the calls should be the interactive message
    const calls = mockFetch.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const interactiveCall = calls.find((b: Record<string, unknown>) => b.type === 'interactive');
    expect(interactiveCall).toBeDefined();
    expect(interactiveCall.interactive.action.buttons).toHaveLength(2);
  });

  it('includes card URL in reply for forwarded messages', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);

    const body = makeWABody({ context: { forwarded: true } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await app.fetch(req, makeEnv());
    const calls = mockFetch.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const interactiveCall = calls.find((b: Record<string, unknown>) => b.type === 'interactive');
    expect(interactiveCall).toBeDefined();
    expect(interactiveCall.interactive.body.text).toContain('ai-grija.ro/card/');
  });

  it('sends plain text message for non-forwarded messages', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);

    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await app.fetch(req, makeEnv());
    const calls = mockFetch.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const textCall = calls.find((b: Record<string, unknown>) => b.type === 'text');
    expect(textCall).toBeDefined();
  });
});
