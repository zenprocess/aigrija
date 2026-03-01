import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

// Mock fetch for Telegram API calls
const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
vi.stubGlobal('fetch', mockFetch);

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
    CACHE: {} as KVNamespace,
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
  beforeEach(() => { mockFetch.mockClear(); });

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
  beforeEach(() => { mockFetch.mockClear(); });

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

describe('Telegram webhook — callback query', () => {
  beforeEach(() => { mockFetch.mockClear(); });

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
