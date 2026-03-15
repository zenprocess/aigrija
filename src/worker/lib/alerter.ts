import type { Env } from './types';
import { withCircuitBreaker, CircuitOpenError } from './circuit-breaker';

export type AlertLevel = 'warn' | 'error' | 'critical';

export function createAlerter(env: Env) {
  return (level: AlertLevel, message: string, context?: Record<string, unknown>) =>
    sendAlert(env, level, message, context);
}

export async function sendAlert(
  env: Env,
  level: AlertLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (level === 'warn') return;

  const chatId = env.TELEGRAM_ADMIN_CHAT_ID;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  // Rate limit: 1 alert per error type per 15min
  const hash = await digestMessage(message);
  const dedupKey = `alert:${hash}`;
  if (env.CACHE) {
    const existing = await env.CACHE.get(dedupKey);
    if (existing) return;
    await env.CACHE.put(dedupKey, '1', { expirationTtl: 900 });
  }

  const text = `[ai-grija ${level.toUpperCase()}]\n${message}${context ? '\n' + JSON.stringify(context, null, 2) : ''}`;

  if (!env.CACHE) {
    await sendTelegramMessage(token, chatId, text, level);
    return;
  }

  try {
    await withCircuitBreaker(env.CACHE, 'telegram', async () => {
      await sendTelegramMessage(token, chatId, text, level);
    }, { failureThreshold: 5, resetTimeout: 30_000 });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      console.warn('[alerter] Telegram circuit OPEN -- skipping alert:', message.substring(0, 80));
      return;
    }
    throw err;
  }
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  level: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.status}`);
  }

  if (level === 'critical') {
    const data = await res.json() as { result?: { message_id?: number } };
    try {
      const pinAbort = new AbortController();
      const pinTimeout = setTimeout(() => pinAbort.abort(), 5000);
      await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: data.result?.message_id }),
        signal: pinAbort.signal,
      });
      clearTimeout(pinTimeout);
    } catch (e) {
      console.error('Failed to pin Telegram message:', e);
    }
  }
}

async function digestMessage(msg: string): Promise<string> {
  const data = new TextEncoder().encode(msg.substring(0, 100));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
