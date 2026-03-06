import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { checkRateLimit } from '../lib/rate-limiter';
import { CAMPAIGNS } from '../data/campaigns';
import { recordConsent, revokeConsent, updateLastActive } from '../lib/gdpr-consent';
import { extractUrls, simpleHash, verdictEmoji, verdictLabel, formatAnalysisReply } from '../lib/bot-helpers';

const telegram = new Hono<{ Bindings: Env; Variables: AppVariables }>();

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
  caption?: string;
  forward_from?: TelegramUser;
  forward_date?: number;
  forward_from_chat?: TelegramChat;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  data?: string;
}

interface TelegramInlineQuery {
  id: string;
  from: { id: number };
  query: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: TelegramInlineQuery;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  inlineKeyboard?: { text: string; url?: string; callback_data?: string }[][]
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (inlineKeyboard) {
    body.reply_markup = {
      inline_keyboard: inlineKeyboard.map(row =>
        row.map(btn => {
          const b: Record<string, string> = { text: btn.text };
          if (btn.url) b.url = btn.url;
          if (btn.callback_data) b.callback_data = btn.callback_data;
          return b;
        })
      ),
    };
  }

  try {
    const smController = new AbortController();
    const smTimeoutId = setTimeout(() => smController.abort(), 5000);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: smController.signal,
      });
    } finally {
      clearTimeout(smTimeoutId);
    }
  } catch (err) {
    structuredLog('error', 'telegram_send_message_failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
  }
}

async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    const acqController = new AbortController();
    const acqTimeoutId = setTimeout(() => acqController.abort(), 5000);
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        signal: acqController.signal,
      });
    } finally {
      clearTimeout(acqTimeoutId);
    }
  } catch (err) {
    structuredLog('error', 'telegram_answer_callback_failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
  }
}

async function answerInlineQuery(
  token: string,
  inlineQueryId: string,
  results: unknown[]
): Promise<void> {
  try {
    const aiqController = new AbortController();
    const aiqTimeoutId = setTimeout(() => aiqController.abort(), 5000);
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerInlineQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inline_query_id: inlineQueryId, results }),
        signal: aiqController.signal,
      });
    } finally {
      clearTimeout(aiqTimeoutId);
    }
  } catch (err) {
    structuredLog('error', 'telegram_answer_inline_failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
  }
}

function buildVerdictKeyboard(
  hash: string,
  baseUrl: string
): { text: string; url?: string; callback_data?: string }[][] {
  return [
    [
      { text: 'Distribuie', callback_data: `share:${hash}` },
      { text: 'Raporteaza', url: `${baseUrl}/raporteaza` },
    ],
    [
      { text: 'Ajutor', callback_data: 'help' },
    ],
  ];
}

// ── Route ────────────────────────────────────────────────────────────────────

telegram.post('/webhook/telegram', async (c) => {
  const rid = c.get('requestId');

  // Verify secret token
  const secret = c.req.header('x-telegram-bot-api-secret-token');
  if (!secret || secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Acces neautorizat. Token webhook invalid.', request_id: rid } }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Corp JSON invalid.', request_id: rid } }, 400);
  }

  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    structuredLog('error', 'telegram_bot_token_missing', { stage: 'config' });
    return c.json({ ok: true });
  }

  const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';

  // ── Callback query handling ───────────────────────────────────────────────

  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data ?? '';

    if (data === 'help') {
      await answerCallbackQuery(token, cq.id, 'Trimite-mi orice mesaj suspect!');
    } else if (data.startsWith('share:')) {
      const hash = data.slice(6);
      await answerCallbackQuery(token, cq.id, `${baseUrl}/card/${hash}`);
    }

    return c.json({ ok: true });
  }

  // ── Inline query handling ─────────────────────────────────────────────────

  if (update.inline_query) {
    const iq = update.inline_query;
    if (iq.query.length >= 3) {
      let classification: Awaited<ReturnType<typeof classify>>;
      try {
        classification = await classify(c.env.AI, iq.query);
      } catch {
        await answerInlineQuery(token, iq.id, []);
        return c.json({ ok: true });
      }

      const hash = simpleHash(iq.query);
      const emoji = verdictEmoji(classification.verdict);
      const label = verdictLabel(classification.verdict);

      await answerInlineQuery(token, iq.id, [
        {
          type: 'article',
          id: hash,
          title: `${emoji} ${label}`,
          description: classification.explanation,
          input_message_content: {
            message_text: `${emoji} <b>${label}</b>\n\n${classification.explanation}\n\n🔗 ${baseUrl}/card/${hash}`,
            parse_mode: 'HTML',
          },
        },
      ]);
    } else {
      await answerInlineQuery(token, iq.id, []);
    }
    return c.json({ ok: true });
  }

  // ── Message handling ──────────────────────────────────────────────────────

  const msg = update.message;
  if (!msg) {
    return c.json({ ok: true });
  }

  const isForwarded = !!(msg.forward_from || msg.forward_date || msg.forward_from_chat);
  const text = (msg.text || msg.caption || '').trim();

  if (!text) {
    // Non-text updates — silently ack
    return c.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;

  // ── Commands ──────────────────────────────────────────────────────────────

  if (text === '/start' || text.startsWith('/start ')) {
    await recordConsent(c.env, 'tg', String(chatId));
    await sendMessage(
      token,
      chatId,
      'Bine ai venit la ai-grija.ro Bot! Trimite-mi orice mesaj suspect si il verific instant. Prin utilizarea acestui bot iti dai consimtamantul pentru prelucrarea datelor (GDPR). Foloseste /sterge pentru a-ti sterge datele. Foloseste /help pentru instructiuni complete.'
    );
    return c.json({ ok: true });
  }

  if (text === '/sterge' || text.startsWith('/sterge ')) {
    await revokeConsent(c.env, 'tg', String(chatId));
    await sendMessage(
      token,
      chatId,
      'Datele tale au fost sterse. Nu vei mai primi alerte.'
    );
    return c.json({ ok: true });
  }

  if (text === '/help' || text.startsWith('/help ')) {
    await sendMessage(
      token,
      chatId,
      'Cum folosesti ai-grija.ro Bot: Trimite textul unui mesaj suspect. Limita: 50 verificari/ora per utilizator. Raporteaza fraude la DNSC: 1911'
    );
    return c.json({ ok: true });
  }

  if (text === '/alerte' || text.startsWith('/alerte ')) {
    const activeCampaigns = CAMPAIGNS.filter(camp => camp.status === 'active');
    const severityEmoji = (s: string) => s === 'critical' ? '🔴' : s === 'high' ? '🟠' : '🟡';
    const lines: string[] = ['Campanii active de phishing:', ''];
    for (const camp of activeCampaigns) {
      lines.push(`${severityEmoji(camp.severity)} ${camp.name_ro} — ${camp.impersonated_entity}`);
    }
    await sendMessage(token, chatId, lines.join('\n'), [
      [{ text: 'Vezi detalii pe ai-grija.ro/alerte', url: 'https://ai-grija.ro/alerte' }],
    ]);
    return c.json({ ok: true });
  }

  if (text === '/about' || text.startsWith('/about ')) {
    await sendMessage(
      token,
      chatId,
      'Despre ai-grija.ro: proiect civic gratuit creat de Zen Labs. Verifica mesaje suspecte, raporteaza la autoritati, protejeaza-ti familia. ai-grija.ro | contact@ai-grija.ro'
    );
    return c.json({ ok: true });
  }

  // ── Record GDPR consent + update last_active ─────────────────────────────
  await recordConsent(c.env, 'tg', String(chatId));
  await updateLastActive(c.env, 'tg', String(chatId));

  // ── Rate limit ────────────────────────────────────────────────────────────

  let rlAllowed = true;
  try {
    const rl = await checkRateLimit(c.env.CACHE, `tg:${userId}`, 50, 3600);
    rlAllowed = rl.allowed;
  } catch {
    // If rate limiter unavailable, allow the request
    rlAllowed = true;
  }
  if (!rlAllowed) {
    await sendMessage(
      token,
      chatId,
      'Ai atins limita de 50 verificari/ora. Te rugam sa incerci din nou mai tarziu.'
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
    structuredLog('error', 'telegram_classify_error', { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    await sendMessage(token, chatId, 'A aparut o eroare la analiza. Te rugam sa incerci din nou.');
    return c.json({ ok: true });
  }

  // URL analysis flags
  const urlFlags: string[] = [];
  const hasUrlKeys = !!(c.env.GOOGLE_SAFE_BROWSING_KEY || c.env.VIRUSTOTAL_API_KEY);
  if (hasUrlKeys) {
    for (const url of urls) {
      try {
        const analysis = await analyzeUrl(url, c.env.GOOGLE_SAFE_BROWSING_KEY, c.env.VIRUSTOTAL_API_KEY, c.env.CACHE);
        if (analysis.is_suspicious) {
          urlFlags.push(...analysis.flags.map((f: string) => `[URL] ${f}`));
        }
      } catch {
        // URL analysis unavailable, skip
      }
    }
  }

  const replyText = formatAnalysisReply(classification, urlFlags, { format: 'html' });
  const hash = simpleHash(text);

  const keyboard = isForwarded
    ? buildVerdictKeyboard(hash, baseUrl)
    : [[{ text: 'Verifica pe ai-grija.ro', url: baseUrl }]];

  await sendMessage(token, chatId, replyText, keyboard);

  return c.json({ ok: true });
});

export { telegram };
