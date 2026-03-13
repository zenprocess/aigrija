import { Hono } from 'hono';
import type { Env, ClassificationResult } from '../lib/types';
import { createClassifier } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { createRateLimiter } from '../lib/rate-limiter';
import { recordConsent, revokeConsent, updateLastActive } from '../lib/gdpr-consent';
import { structuredLog } from '../lib/logger';
import { timingSafeEqual } from '../lib/webhook-verify';
import { extractUrls, simpleHash, formatAnalysisReply } from '../lib/bot-helpers';

const whatsapp = new Hono<{ Bindings: Env }>();

// ── WhatsApp Cloud API types (minimal) ────────────────────────────────────────

interface WhatsAppTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
  context?: { forwarded?: boolean; frequently_forwarded?: boolean };
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
    structuredLog('error', 'whatsapp_send_failed', { error: String(err) });
  }
}

async function sendWhatsAppInteractive(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
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
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      }),
    });
  } catch (err) {
    structuredLog('error', 'whatsapp_interactive_failed', { error: String(err) });
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
    structuredLog('error', 'whatsapp_mark_read_failed', { error: String(err) });
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
  return timingSafeEqual(computed, expected);
}

// ── Routes ────────────────────────────────────────────────────────────────────

whatsapp.get('/webhook/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return c.json({ error: { code: 'FORBIDDEN', message: 'Acces interzis. Token de verificare invalid.' }, request_id: 'unknown' }, 403);
});

whatsapp.post('/webhook/whatsapp', async (c) => {
  const rawBody = await c.req.text();

  // Verify X-Hub-Signature-256 when app secret is configured
  if (c.env.WHATSAPP_APP_SECRET) {
    const sigHeader = c.req.header('x-hub-signature-256') ?? null;
    const valid = await verifyHmacSha256(c.env.WHATSAPP_APP_SECRET, rawBody, sigHeader);
    if (!valid) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Acces neautorizat. Semnatura invalida.' } }, 401);
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
    structuredLog('error', 'whatsapp_config_missing', { detail: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set' });
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

        const upperText = text.toUpperCase();

        // GDPR: first-time opt-in
        if (upperText === 'START') {
          await recordConsent(c.env, 'wa', from);
          await sendWhatsAppMessage(
            accessToken,
            phoneNumberId,
            from,
            'Bine ai venit la ai-grija.ro! Prin trimiterea acestui mesaj ti-ai dat consimtamantul pentru prelucrarea datelor (GDPR). Trimite STERGE oricand pentru a-ti sterge datele.'
          );
          continue;
        }

        // GDPR: opt-out / delete
        if (upperText === 'STERGE' || upperText === 'STOP') {
          await revokeConsent(c.env, 'wa', from);
          await sendWhatsAppMessage(
            accessToken,
            phoneNumberId,
            from,
            'Datele tale au fost sterse. Nu vei mai primi alerte de la ai-grija.ro.'
          );
          continue;
        }

        // Record consent on first message (implicit opt-in) and update last_active
        await recordConsent(c.env, 'wa', from);
        await updateLastActive(c.env, 'wa', from);

        const rl = await createRateLimiter(c.env.CACHE)(`wa:${from}`, 50, 3600);
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

        let classification: ClassificationResult;
        try {
          classification = await createClassifier(c.env.AI)(text, firstUrl);
        } catch (err) {
          structuredLog('error', 'whatsapp_classify_error', { error: String(err) });
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
          try {
            const analysis = await analyzeUrl(url, c.env.GOOGLE_SAFE_BROWSING_KEY, c.env.VIRUSTOTAL_API_KEY, c.env.CACHE);
            if (analysis.is_suspicious) {
              urlFlags.push(...analysis.flags.map((f: string) => `[URL] ${f}`));
            }
          } catch (err) {
            structuredLog('error', 'whatsapp_url_analysis_failed', { url, error: String(err) });
            // Continue to next URL
          }
        }

        const isForwarded = !!(message.context?.forwarded || message.context?.frequently_forwarded);
        const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
        const hash = simpleHash(text);
        const cardUrl = `${baseUrl}/card/${hash}`;

        const replyText = formatAnalysisReply(classification, urlFlags, { format: 'whatsapp', isForwarded, cardUrl });

        if (isForwarded) {
          // Send interactive message with action buttons for forwarded messages
          await sendWhatsAppInteractive(accessToken, phoneNumberId, from, replyText, [
            { id: 'report', title: 'Raportează' },
            { id: 'share', title: 'Distribuie' },
          ]);
        } else {
          await sendWhatsAppMessage(accessToken, phoneNumberId, from, replyText);
        }
      }
    }
  }

  return c.json({ ok: true });
});

export { whatsapp };
