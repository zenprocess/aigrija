import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { checkRateLimit } from '../lib/rate-limiter';

const telegram = new Hono<{ Bindings: Env }>();

// ── Telegram Bot API types (minimal) ────────────────────────────────────────

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  return text.match(urlRegex) ?? [];
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  inlineKeyboard?: { text: string; url: string }[][]
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (inlineKeyboard) {
    body.reply_markup = {
      inline_keyboard: inlineKeyboard.map(row =>
        row.map(btn => ({ text: btn.text, url: btn.url }))
      ),
    };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function verdictEmoji(verdict: string): string {
  if (verdict === 'phishing') return '🔴';
  if (verdict === 'suspicious') return '🟡';
  return '🟢';
}

function verdictLabel(verdict: string): string {
  if (verdict === 'phishing') return 'PHISHING DETECTAT';
  if (verdict === 'suspicious') return 'MESAJ SUSPECT';
  return 'PROBABIL SIGUR';
}

function formatAnalysisReply(
  result: Awaited<ReturnType<typeof classify>>,
  urlFlags: string[]
): string {
  const emoji = verdictEmoji(result.verdict);
  const label = verdictLabel(result.verdict);
  const confidencePct = Math.round(result.confidence * 100);

  const lines: string[] = [
    `${emoji} <b>${label}</b>`,
    `<i>Confidență: ${confidencePct}%</i>`,
    '',
    `📋 <b>Explicație:</b>`,
    result.explanation,
  ];

  const allFlags = [...result.red_flags, ...urlFlags];
  if (allFlags.length > 0) {
    lines.push('', '🚩 <b>Semne de alarmă:</b>');
    for (const flag of allFlags) {
      lines.push(`• ${flag}`);
    }
  }

  if (result.recommended_actions.length > 0) {
    lines.push('', '✅ <b>Acțiuni recomandate:</b>');
    result.recommended_actions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
  }

  return lines.join('\n');
}

// ── Route ────────────────────────────────────────────────────────────────────

telegram.post('/webhook/telegram', async (c) => {
  const rid = c.get('requestId' as never) as string;

  // Verify secret token
  const secret = c.req.header('x-telegram-bot-api-secret-token');
  if (c.env.TELEGRAM_WEBHOOK_SECRET && secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized', request_id: rid } }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON', request_id: rid } }, 400);
  }

  const message = update.message;
  if (!message || !message.text) {
    // Non-text updates — silently ack
    return c.json({ ok: true });
  }

  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const text = message.text.trim();
  const token = c.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN not set');
    return c.json({ ok: true });
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  if (text === '/start' || text.startsWith('/start ')) {
    await sendMessage(
      token,
      chatId,
      '👋 <b>Bine ai venit la ai-grija.ro Bot!</b>\n\nTrimite-mi orice mesaj suspect și îl verific instant.\n\nPoți trimite:\n• SMS-uri suspecte\n• URL-uri dubioase\n• Emailuri de phishing\n\nFolosește /help pentru instrucțiuni complete.'
    );
    return c.json({ ok: true });
  }

  if (text === '/help' || text.startsWith('/help ')) {
    await sendMessage(
      token,
      chatId,
      '🛡️ <b>Cum folosești ai-grija.ro Bot:</b>\n\n' +
        '1. <b>Trimite textul</b> unui mesaj suspect (SMS, email, notificare)\n' +
        '2. <b>Sau trimite un URL</b> pe care nu știi dacă e sigur\n' +
        '3. <b>Primești instant</b> o analiză cu verdict și sfaturi\n\n' +
        '<b>Verdictele posibile:</b>\n' +
        '🔴 PHISHING DETECTAT — mesaj periculos, nu accesa linkurile\n' +
        '🟡 MESAJ SUSPECT — fii precaut\n' +
        '🟢 PROBABIL SIGUR — pare legitim\n\n' +
        '⚠️ Limita: 20 verificări/oră per utilizator.\n\n' +
        'Raportează fraude la DNSC: <b>1911</b>'
    );
    return c.json({ ok: true });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────

  const rl = await checkRateLimit(c.env.CACHE, `tg:${userId}`, 20, 3600);
  if (!rl.allowed) {
    await sendMessage(
      token,
      chatId,
      '⏳ Ai atins limita de 20 verificări/oră. Te rugăm să încerci din nou mai târziu.'
    );
    return c.json({ ok: true });
  }

  // ── Classify ──────────────────────────────────────────────────────────────

  const urls = extractUrls(text);
  const firstUrl = urls[0];

  let classification: Awaited<ReturnType<typeof classify>>;
  try {
    classification = await classify(c.env.AI, text, firstUrl);
  } catch (err) {
    console.error('[telegram] classify error:', err);
    await sendMessage(token, chatId, '❌ A apărut o eroare la analiză. Te rugăm să încerci din nou.');
    return c.json({ ok: true });
  }

  // URL analysis flags
  const urlFlags: string[] = [];
  for (const url of urls) {
    const analysis = await analyzeUrl(url, c.env.GOOGLE_SAFE_BROWSING_KEY);
    if (analysis.is_suspicious) {
      urlFlags.push(...analysis.flags.map((f: string) => `[URL] ${f}`));
    }
  }

  const replyText = formatAnalysisReply(classification, urlFlags);

  await sendMessage(token, chatId, replyText, [
    [{ text: '🔍 Verifică pe ai-grija.ro', url: 'https://ai-grija.ro' }],
  ]);

  return c.json({ ok: true });
});

export { telegram };
