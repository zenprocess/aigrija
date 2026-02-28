import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { checkRateLimit } from '../lib/rate-limiter';

const whatsapp = new Hono<{ Bindings: Env }>();

// ── WhatsApp Cloud API types (minimal) ────────────────────────────────────────

interface WhatsAppTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

interface WhatsAppValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile: { name: string }; wa_id: string }[];
  messages?: WhatsAppTextMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ value: WhatsAppValue; field: string }>;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  return text.match(urlRegex) ?? [];
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
    `${emoji} *${label}*`,
    `_Confidenta: ${confidencePct}%_`,
    '',
    `Explicatie:`,
    result.explanation,
  ];

  const allFlags = [...result.red_flags, ...urlFlags];
  if (allFlags.length > 0) {
    lines.push('', 'Semne de alarma:');
    for (const flag of allFlags) {
      lines.push(`- ${flag}`);
    }
  }

  if (result.recommended_actions.length > 0) {
    lines.push('', 'Actiuni recomandate:');
    result.recommended_actions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
  }

  lines.push('', 'Verifica pe https://ai-grija.ro');

  return lines.join('\n');
}

async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  text: string
): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
  } catch (err) {
    console.error('[whatsapp] sendWhatsAppMessage failed:', err);
  }
}

async function markMessageRead(
  accessToken: string,
  phoneNumberId: string,
  messageId: string
): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  } catch (err) {
    console.error('[whatsapp] markMessageRead failed:', err);
  }
}


// ── HMAC-SHA256 signature verification ───────────────────────────────────────

async function verifyHmacSha256(secret: string, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice('sha256='.length);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === expected;
}

// ── Routes ────────────────────────────────────────────────────────────────────

whatsapp.get('/webhook/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return c.text('Forbidden', 403);
});

whatsapp.post('/webhook/whatsapp', async (c) => {
  const rawBody = await c.req.text();

  // Verify X-Hub-Signature-256 when app secret is configured
  if (c.env.WHATSAPP_APP_SECRET) {
    const sigHeader = c.req.header('x-hub-signature-256') ?? null;
    const valid = await verifyHmacSha256(c.env.WHATSAPP_APP_SECRET, rawBody, sigHeader);
    if (!valid) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
    }
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(rawBody) as WhatsAppWebhookBody;
  } catch {
    return c.json({ ok: true });
  }

  if (body.object !== 'whatsapp_business_account') {
    return c.json({ ok: true });
  }

  const accessToken = c.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = c.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.error('[whatsapp] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set');
    return c.json({ ok: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      if (value.statuses && value.statuses.length > 0) {
        continue;
      }

      for (const message of value.messages ?? []) {
        if (message.type !== 'text' || !message.text?.body) {
          continue;
        }

        const from = message.from;
        const messageId = message.id;
        const text = message.text.body.trim();

        await markMessageRead(accessToken, phoneNumberId, messageId);

        const rl = await checkRateLimit(c.env.CACHE, `wa:${from}`, 50, 3600);
        if (!rl.allowed) {
          await sendWhatsAppMessage(
            accessToken,
            phoneNumberId,
            from,
            'Ai atins limita de 50 verificări/oră. Te rugăm să încerci din nou mai târziu.'
          );
          continue;
        }

        const urls = extractUrls(text);
        const firstUrl = urls[0];

        let classification: Awaited<ReturnType<typeof classify>>;
        try {
          classification = await classify(c.env.AI, text, firstUrl);
        } catch (err) {
          console.error('[whatsapp] classify error:', err);
          await sendWhatsAppMessage(
            accessToken,
            phoneNumberId,
            from,
            'A aparut o eroare la analiza. Te rugam sa incerci din nou.'
          );
          continue;
        }

        const urlFlags: string[] = [];
        for (const url of urls) {
          const analysis = await analyzeUrl(url, c.env.GOOGLE_SAFE_BROWSING_KEY, c.env.VIRUSTOTAL_API_KEY, c.env.CACHE);
          if (analysis.is_suspicious) {
            urlFlags.push(...analysis.flags.map((f: string) => `[URL] ${f}`));
          }
        }

        const replyText = formatAnalysisReply(classification, urlFlags);
        await sendWhatsAppMessage(accessToken, phoneNumberId, from, replyText);
      }
    }
  }

  return c.json({ ok: true });
});

export { whatsapp };
