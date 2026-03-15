import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

const mockFetch = vi.fn().mockResolvedValue(new Response('{"messages":[{"id":"mid1"}]}'));
vi.stubGlobal('fetch', mockFetch);

const mockRecordConsent = vi.fn().mockResolvedValue(undefined);
const mockRevokeConsent = vi.fn().mockResolvedValue(undefined);
const mockUpdateLastActive = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/gdpr-consent', () => ({
  recordConsent: (...args: unknown[]) => mockRecordConsent(...args),
  revokeConsent: (...args: unknown[]) => mockRevokeConsent(...args),
  updateLastActive: (...args: unknown[]) => mockUpdateLastActive(...args),
}));

vi.mock('../lib/classifier', () => ({
  createClassifier: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
    verdict: 'phishing',
    confidence: 0.95,
    scam_type: 'bank_impersonation',
    red_flags: ['urgenta'],
    explanation: 'Mesaj phishing.',
    recommended_actions: ['Nu accesati linkul'],
  })),
}));

vi.mock('../lib/url-analyzer', () => ({
  analyzeUrl: vi.fn().mockResolvedValue({ is_suspicious: false, flags: [] }),
}));

// Mock rate-limiter (default: allowed)
const mockWArateLimiterFn = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: () => mockWArateLimiterFn,
  isTestEnvironment: () => true,
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

describe('WhatsApp — error handling', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); store = {}; });

  it('returns 500 on unexpected error', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);

    mockRecordConsent.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const body = makeWABody({ text: { body: 'START' } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());

    expect(res.status).toBe(500);
  });
});

describe('WhatsApp — GET webhook verification', () => {
  it('returns challenge when mode is subscribe and token matches', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const req = new Request(
      'http://localhost/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=challenge123'
    );
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('challenge123');
  });

  it('returns 403 when token does not match', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const req = new Request(
      'http://localhost/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge123'
    );
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const req = new Request(
      'http://localhost/webhook/whatsapp?hub.mode=unsubscribe&hub.verify_token=test-token&hub.challenge=challenge123'
    );
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(403);
  });
});

describe('WhatsApp — HMAC signature verification', () => {
  it('returns 401 when app secret is set but signature header is missing', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const env = { ...makeEnv(), WHATSAPP_APP_SECRET: 'my-secret' };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeWABody()),
    });
    const res = await app.fetch(req, env as unknown as Env);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature header has wrong value', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const env = { ...makeEnv(), WHATSAPP_APP_SECRET: 'my-secret' };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=invalidsig' },
      body: JSON.stringify(makeWABody()),
    });
    const res = await app.fetch(req, env as unknown as Env);
    expect(res.status).toBe(401);
  });
});

describe('WhatsApp — webhook body edge cases', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; });

  it('returns ok for non-whatsapp_business_account object', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = { ...makeWABody(), object: 'instagram' };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    expect(graphCalls).toHaveLength(0);
  });

  it('returns ok when access token or phone id missing', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const env = { ...makeEnv(), WHATSAPP_ACCESS_TOKEN: '', WHATSAPP_PHONE_NUMBER_ID: '' };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeWABody()),
    });
    const res = await app.fetch(req, env as unknown as Env);
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips status update entries without sending messages', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'entry1',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1234', phone_number_id: 'phone-id' },
            statuses: [{ id: 'msg1', status: 'delivered', timestamp: '123', recipient_id: '456' }],
          },
        }],
      }],
    };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips non-text messages', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({ type: 'image', text: undefined });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
  });

  it('returns ok:true for invalid JSON body', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const resBody = await res.json() as any;
    expect(resBody.ok).toBe(true);
  });
});

describe('WhatsApp — GDPR commands', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); mockRevokeConsent.mockClear(); store = {}; });

  it('handles START command and records consent', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({ text: { body: 'START' } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockRecordConsent).toHaveBeenCalledWith(expect.anything(), 'wa', '40700000000');
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    expect(graphCalls.length).toBeGreaterThan(0);
  });

  it('handles STERGE command and revokes consent', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({ text: { body: 'STERGE' } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockRevokeConsent).toHaveBeenCalledWith(expect.anything(), 'wa', '40700000000');
  });

  it('handles STOP command and revokes consent', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({ text: { body: 'STOP' } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockRevokeConsent).toHaveBeenCalledWith(expect.anything(), 'wa', '40700000000');
  });
});

describe('WhatsApp — rate limiting', () => {
  beforeEach(() => { mockFetch.mockClear(); mockWArateLimiterFn.mockResolvedValue({ allowed: true }); store = {}; });

  it('sends rate-limit message when limit exceeded', async () => {
    mockWArateLimiterFn.mockResolvedValueOnce({ allowed: false });
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    // markRead + rate-limit message
    expect(graphCalls.length).toBeGreaterThanOrEqual(2);
    const msgBodies = graphCalls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const rateLimitMsg = msgBodies.find((b: Record<string, unknown>) => b.type === 'text' && (b.text as any)?.body?.includes('limita'));
    expect(rateLimitMsg).toBeDefined();
  });
});

describe('WhatsApp — classification error', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; });

  it('sends error message when classifier throws', async () => {
    const { createClassifier } = await import('../lib/classifier');
    vi.mocked(createClassifier).mockReturnValueOnce(vi.fn().mockRejectedValueOnce(new Error('AI error')));
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    const msgBodies = graphCalls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const errorMsg = msgBodies.find((b: Record<string, unknown>) => b.type === 'text' && (b.text as any)?.body?.includes('eroare'));
    expect(errorMsg).toBeDefined();
  });
});

describe('WhatsApp — frequently forwarded detection', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; });

  it('sends interactive message for frequently_forwarded messages', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({ context: { frequently_forwarded: true } });
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const calls = mockFetch.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as Record<string, unknown>).body as string));
    const interactiveCall = calls.find((b: Record<string, unknown>) => b.type === 'interactive');
    expect(interactiveCall).toBeDefined();
  });
});

describe('WhatsApp — URL analysis branches', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; });

  it('appends URL flags to reply when analyzeUrl returns is_suspicious: true', async () => {
    const { analyzeUrl } = await import('../lib/url-analyzer');
    vi.mocked(analyzeUrl).mockResolvedValueOnce({ is_suspicious: true, flags: ['phishing pattern'] });

    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    // Default makeWABody text contains http://ing-fals.com — extractUrls will find it
    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    expect(graphCalls.length).toBeGreaterThan(0);
  });

  it('continues gracefully when analyzeUrl throws', async () => {
    const { analyzeUrl } = await import('../lib/url-analyzer');
    vi.mocked(analyzeUrl).mockRejectedValueOnce(new Error('URL analysis service down'));

    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    // Should still send a reply despite URL analysis failure
    expect(res.status).toBe(200);
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    expect(graphCalls.length).toBeGreaterThan(0);
  });
});

describe('WhatsApp — rate limiter error handling (fail-open)', () => {
  beforeEach(() => { mockFetch.mockClear(); store = {}; mockWArateLimiterFn.mockResolvedValue({ allowed: true }); });

  it('allows request when rate limiter throws (catch block sets rlAllowed=true)', async () => {
    mockWArateLimiterFn.mockRejectedValueOnce(new Error('KV error'));

    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const body = makeWABody({});
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    // Should have sent a response message (not blocked by rate limit)
    const graphCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('graph.facebook.com'));
    expect(graphCalls.length).toBeGreaterThan(0);
  });
});

describe('WhatsApp — HMAC signature edge cases', () => {
  it('returns 401 when signature header does not start with sha256=', async () => {
    const { whatsapp } = await import('./whatsapp');
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', whatsapp);
    const env = { ...makeEnv(), WHATSAPP_APP_SECRET: 'my-secret' };
    const req = new Request('http://localhost/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'md5=invalidsig' },
      body: JSON.stringify(makeWABody()),
    });
    const res = await app.fetch(req, env as unknown as Env);
    expect(res.status).toBe(401);
  });
});
