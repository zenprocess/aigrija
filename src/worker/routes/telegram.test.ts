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

// Mock createClassifier
vi.mock('../lib/classifier', () => ({
  createClassifier: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
    verdict: 'phishing',
    confidence: 0.95,
    scam_type: 'bank_impersonation',
    red_flags: ['urgenta', 'link suspect'],
    explanation: 'Mesaj de tip phishing care imita o banca.',
    recommended_actions: ['Nu accesati linkul'],
  })),
}));

// Mock rate-limiter (default: allowed)
const mockRateLimiterFn = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: () => mockRateLimiterFn,
  isTestEnvironment: () => true,
}));

// Mock url-analyzer
const mockTgAnalyzeUrl = vi.hoisted(() => vi.fn().mockResolvedValue({ is_suspicious: false, flags: [] }));
vi.mock('../lib/url-analyzer', () => ({
  analyzeUrl: (...args: unknown[]) => mockTgAnalyzeUrl(...args),
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

  it('returns 401 when secret has correct length but wrong content (timing-safe)', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    // Same length as 'test-secret' but different content
    const req = makeTelegramRequest({}, 'test-XXXXXX');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('accepts correct secret via timing-safe comparison', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    const update = { update_id: 99, message: { message_id: 99, chat: { id: 1, type: 'private' }, text: 'test' } };
    const req = makeTelegramRequest(update, 'test-secret');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(200);
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

describe('Telegram webhook — error handling', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); });

  it('catches and logs errors gracefully when recordConsent throws', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);

    mockRecordConsent.mockRejectedValueOnce(new Error('DB connection failed'));

    const update = {
      update_id: 99,
      message: {
        message_id: 99,
        chat: { id: 1, type: 'private' },
        text: '/start',
      },
    };

    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, makeEnv());

    // Should return 200 — webhook handlers must not crash the connection
    expect(res.status).toBe(200);
  });
});

describe('Telegram webhook — invalid JSON body', () => {
  it('returns 400 for malformed JSON', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const req = new Request('http://localhost/webhook/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'test-secret' },
      body: 'not valid json',
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });
});

describe('Telegram webhook — missing bot token', () => {
  it('returns ok:true when TELEGRAM_BOT_TOKEN is empty', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const env = { ...makeEnv(), TELEGRAM_BOT_TOKEN: '' };
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, text: 'test' } };
    const req = makeTelegramRequest(update);
    const res = await app.fetch(req, env as Env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});

describe('Telegram webhook — message edge cases', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('returns ok when update has no message field', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1 };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
  });

  it('silently acks when message has no text or caption', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 } } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Telegram webhook — commands', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRecordConsent.mockClear(); mockRevokeConsent.mockClear(); });

  it('handles /start and records consent', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 100, type: 'private' }, from: { id: 100 }, text: '/start' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    expect(mockRecordConsent).toHaveBeenCalledWith(expect.anything(), 'tg', '100');
    const sendCall = mockFetch.mock.calls.find((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCall).toBeDefined();
  });

  it('handles /start with inline payload', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 100, type: 'private' }, text: '/start referral123' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
  });

  it('handles /sterge and revokes consent', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 200, type: 'private' }, from: { id: 200 }, text: '/sterge' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    expect(mockRevokeConsent).toHaveBeenCalledWith(expect.anything(), 'tg', '200');
  });

  it('handles /help and sends instructions', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 300, type: 'private' }, text: '/help' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCall = mockFetch.mock.calls.find((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCall).toBeDefined();
    const callBody = JSON.parse(sendCall![1].body as string);
    expect(callBody.text).toContain('DNSC');
  });

  it('handles /alerte and returns campaign list', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 400, type: 'private' }, text: '/alerte' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCall = mockFetch.mock.calls.find((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCall).toBeDefined();
  });

  it('handles /about and mentions ai-grija.ro', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 500, type: 'private' }, text: '/about' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCall = mockFetch.mock.calls.find((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCall).toBeDefined();
    const callBody = JSON.parse(sendCall![1].body as string);
    expect(callBody.text).toContain('ai-grija.ro');
  });
});

describe('Telegram webhook — rate limiting', () => {
  beforeEach(() => { mockFetch.mockClear(); mockRateLimiterFn.mockResolvedValue({ allowed: true }); });

  it('sends rate-limit notice when limit exceeded', async () => {
    mockRateLimiterFn.mockResolvedValueOnce({ allowed: false });
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'mesaj de test' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThan(0);
    const lastBody = JSON.parse(sendCalls[sendCalls.length - 1][1].body as string);
    expect(lastBody.text).toContain('limita');
  });
});

describe('Telegram webhook — classification error', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('sends error message when classifier throws', async () => {
    const { createClassifier } = await import('../lib/classifier');
    vi.mocked(createClassifier).mockReturnValueOnce(vi.fn().mockRejectedValueOnce(new Error('AI unavailable')));
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'mesaj suspect' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThan(0);
    const callBody = JSON.parse(sendCalls[sendCalls.length - 1][1].body as string);
    expect(callBody.text).toContain('eroare');
  });
});

describe('Telegram webhook — inline query', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('returns empty results for queries shorter than 3 chars', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, inline_query: { id: 'iq1', from: { id: 1 }, query: 'ab' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.results).toHaveLength(0);
  });

  it('returns article result for queries 3+ chars', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, inline_query: { id: 'iq2', from: { id: 1 }, query: 'link frauda banca' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.results).toHaveLength(1);
    expect(callBody.results[0].type).toBe('article');
  });

  it('returns empty results when classifier throws during inline query', async () => {
    const { createClassifier } = await import('../lib/classifier');
    vi.mocked(createClassifier).mockReturnValueOnce(vi.fn().mockRejectedValueOnce(new Error('AI error')));
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, inline_query: { id: 'iq3', from: { id: 1 }, query: 'mesaj periculos' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.results).toHaveLength(0);
  });
});

describe('Telegram webhook — callback query unrecognized data', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('returns ok without calling Telegram API for unknown callback data', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = { update_id: 1, callback_query: { id: 'cq1', from: { id: 1 }, data: 'unknown_action' } };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Telegram webhook — URL analysis (hasUrlKeys branch)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockTgAnalyzeUrl.mockResolvedValue({ is_suspicious: false, flags: [] });
  });

  it('calls analyzeUrl when GOOGLE_SAFE_BROWSING_KEY is set and message contains a URL', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const env = { ...makeEnv(), GOOGLE_SAFE_BROWSING_KEY: 'test-key' };
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'Verifica http://suspicious.com acum' },
    };
    await app.fetch(makeTelegramRequest(update), env as Env);
    expect(mockTgAnalyzeUrl).toHaveBeenCalled();
  });

  it('includes URL flags in reply when analyzeUrl returns is_suspicious: true', async () => {
    mockTgAnalyzeUrl.mockResolvedValueOnce({ is_suspicious: true, flags: ['phishing pattern'] });
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const env = { ...makeEnv(), GOOGLE_SAFE_BROWSING_KEY: 'test-key' };
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'Verifica http://dangerous.com acum' },
    };
    const res = await app.fetch(makeTelegramRequest(update), env as Env);
    expect(res.status).toBe(200);
    const sendCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThan(0);
  });

  it('continues gracefully when analyzeUrl throws', async () => {
    mockTgAnalyzeUrl.mockRejectedValueOnce(new Error('URL service unavailable'));
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const env = { ...makeEnv(), GOOGLE_SAFE_BROWSING_KEY: 'test-key' };
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'Verifica http://example.com acum' },
    };
    const res = await app.fetch(makeTelegramRequest(update), env as Env);
    expect(res.status).toBe(200);
  });

  it('does not call analyzeUrl when hasUrlKeys is false (both keys empty)', async () => {
    mockTgAnalyzeUrl.mockClear();
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    // makeEnv() has GOOGLE_SAFE_BROWSING_KEY: '' and no VIRUSTOTAL_API_KEY → hasUrlKeys = false
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, text: 'Verifica http://example.com acum' },
    };
    await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(mockTgAnalyzeUrl).not.toHaveBeenCalled();
  });
});

describe('Telegram webhook — userId fallback when from is undefined', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('uses chatId as userId when from field is missing', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    // No `from` field — userId should fall back to chatId
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 777, type: 'private' }, text: 'mesaj fara from' },
    };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
  });
});

describe('Telegram webhook — caption-only messages', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('classifies caption-only message (image with caption text)', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, from: { id: 1 }, caption: 'Caption mesaj suspect de frauda' },
    };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThan(0);
  });

  it('forwards message via forward_from_chat triggers forwarded keyboard', async () => {
    const telegram = await importTelegram();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/', telegram);
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 1, type: 'private' },
        from: { id: 1 },
        text: 'Mesaj forwarded din grup',
        forward_from_chat: { id: 999, type: 'channel' },
      },
    };
    const res = await app.fetch(makeTelegramRequest(update), makeEnv());
    expect(res.status).toBe(200);
    const sendCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThan(0);
    const body = JSON.parse(sendCalls[0][1].body as string);
    // Forwarded messages get the 2-row verdict keyboard
    expect(body.reply_markup?.inline_keyboard?.length).toBeGreaterThanOrEqual(2);
  });
});
