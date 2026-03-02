import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

// Mock fetch for Telegram API calls
const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
vi.stubGlobal('fetch', mockFetch);

// Mock gdpr-consent
const mockRecordConsent = vi.fn().mockResolvedValue(undefined);
const mockRevokeConsent = vi.fn().mockResolvedValue(undefined);
const mockUpdateLastActive = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/gdpr-consent', () => ({
  recordConsent: (...args: unknown[]) => mockRecordConsent(...args),
  revokeConsent: (...args: unknown[]) => mockRevokeConsent(...args),
  updateLastActive: (...args: unknown[]) => mockUpdateLastActive(...args),
}));

// Mock classify
vi.mock('../lib/classifier', () => ({
  classify: vi.fn().mockResolvedValue({
    verdict: 'phishing',
    confidence: 0.95,
    scam_type: 'bank_impersonation',
    red_flags: ['urgenta', 'link suspect'],
    explanation: 'Mesaj de tip phishing care imita o banca.',
    recommended_actions: ['Nu accesati linkul'],
  }),
}));

function makeEnv(): Env {
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined), list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }) } as unknown as KVNamespace,
    STORAGE: {} as R2Bucket,
    BASE_URL: 'https://ai-grija.ro',
    GOOGLE_SAFE_BROWSING_KEY: '',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    WHATSAPP_VERIFY_TOKEN: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    ADMIN_API_KEY: '',
    ADMIN_DB: {} as D1Database,
  } as Env;
}

async function importTelegram() {
  const { telegram } = await import('./telegram');
  return telegram;
}

function makeTelegramRequest(body: unknown, secret = 'test-secret') {
  return new Request('http://localhost/webhook/telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  });
}

describe('Telegram webhook — auth', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); mockUpdateLastActive.mockClear(); });

  it('returns 401 without secret', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const req = new Request('http://localhost/webhook/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const req = makeTelegramRequest({}, 'wrong-secret');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });
});

describe('Telegram webhook — forwarded message detection', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); mockUpdateLastActive.mockClear(); });

  it('analyzes forwarded message and sends verdict', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123456, type: 'private' },
        from: { id: 789, username: 'user' },
        text: 'Contul dvs va fi blocat. Accesati acum: http://ing-fals.com',
        forward_from: { id: 999, username: 'spammer' },
        forward_date: Math.floor(Date.now() / 1000),
      },
    };

    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    // Should have called Telegram API to send message
    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain('sendMessage');
  });

  it('includes inline keyboard in verdict reply', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = {
      update_id: 2,
      message: {
        message_id: 2,
        chat: { id: 123456, type: 'private' },
        from: { id: 789 },
        text: 'SMS fals de la banca',
        forward_date: Math.floor(Date.now() / 1000),
      },
    };

    const req = makeTelegramRequest(update);
    await app.fetch(req, makeEnv());

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard).toBeInstanceOf(Array);
    expect(body.reply_markup.inline_keyboard.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Telegram webhook — GDPR consent on regular messages', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); mockUpdateLastActive.mockClear(); });

  it('calls recordConsent for every regular message (not just /start)', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = {
      update_id: 10,
      message: {
        message_id: 10,
        chat: { id: 111222, type: 'private' },
        from: { id: 333, username: 'testuser' },
        text: 'Contul meu a fost blocat, ajutor!',
      },
    };

    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockRecordConsent).toHaveBeenCalledWith(
      expect.anything(),
      'tg',
      '111222'
    );
  });

  it('calls recordConsent before updateLastActive for regular messages', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const callOrder: string[] = [];
    mockRecordConsent.mockImplementation(async () => { callOrder.push('recordConsent'); });
    mockUpdateLastActive.mockImplementation(async () => { callOrder.push('updateLastActive'); });

    const update = {
      update_id: 11,
      message: {
        message_id: 11,
        chat: { id: 444555, type: 'private' },
        from: { id: 666 },
        text: 'Mesaj suspect de test',
      },
    };

    await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(callOrder.indexOf('recordConsent')).toBeLessThan(callOrder.indexOf('updateLastActive'));
  });
});

describe('Telegram webhook — callback query', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); });

  it('handles help callback', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = {
      update_id: 3,
      callback_query: {
        id: 'cq1',
        from: { id: 789 },
        data: 'help',
      },
    };

    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('answerCallbackQuery'),
      expect.anything()
    );
  });

  it('handles share callback', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = {
      update_id: 4,
      callback_query: {
        id: 'cq2',
        from: { id: 789 },
        data: 'share:abc12345',
      },
    };

    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.text).toContain('ai-grija.ro/card/abc12345');
  });
});
