import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAlert } from './alerter';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeEnv(overrides?: Partial<Record<string, unknown>>) {
  const store = new Map<string, string>();
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
  };
  return {
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_ADMIN_CHAT_ID: '123456',
    CACHE: kv,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ result: { message_id: 42 } }),
  });
});

describe('sendAlert', () => {
  it('warn level does not call fetch', async () => {
    await sendAlert(makeEnv(), 'warn', 'test warning');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('error level sends a Telegram message', async () => {
    await sendAlert(makeEnv(), 'error', 'something broke');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/sendMessage');
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe('123456');
    expect(body.text).toContain('ERROR');
  });

  it('critical level sends message and pins it', async () => {
    await sendAlert(makeEnv(), 'critical', 'critical failure');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const pinUrl = mockFetch.mock.calls[1][0] as string;
    expect(pinUrl).toContain('/pinChatMessage');
  });

  it('dedup suppresses second identical alert within 15min', async () => {
    const env = makeEnv();
    await sendAlert(env, 'error', 'duplicate error');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await sendAlert(env, 'error', 'duplicate error');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing when TELEGRAM_BOT_TOKEN missing', async () => {
    const env = makeEnv({ TELEGRAM_BOT_TOKEN: undefined });
    await sendAlert(env, 'error', 'no token');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
