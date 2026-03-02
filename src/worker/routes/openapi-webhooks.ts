import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';

// ── 13. POST /webhook/telegram — Telegram bot webhook ────────────────────────

const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      first_name: z.string(),
      username: z.string().optional(),
    }).optional(),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    text: z.string().optional(),
    caption: z.string().optional(),
    forward_from: z.object({ id: z.number(), first_name: z.string() }).optional(),
    forward_date: z.number().optional(),
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({ id: z.number() }),
    data: z.string().optional(),
  }).optional(),
  inline_query: z.object({
    id: z.string(),
    from: z.object({ id: z.number() }),
    query: z.string(),
  }).optional(),
});

export class TelegramWebhookEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Webhooks'],
    summary: 'Webhook Telegram Bot',
    description: 'Primeste actualizari de la Telegram Bot API. Suporta mesaje text, comenzi (/start, /help, /sterge, /alerte, /about), callback queries, si inline queries. Verificarea se face prin headerul x-telegram-bot-api-secret-token.',
    request: {
      headers: z.object({
        'x-telegram-bot-api-secret-token': z.string().describe('Token secret configurat la setarea webhook-ului Telegram'),
      }),
      body: {
        content: {
          'application/json': {
            schema: TelegramUpdateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Actualizare procesata',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
      '401': {
        description: 'Token webhook invalid',
        content: {
          'application/json': {
            schema: z.object({
              error: z.object({
                code: z.string(),
                message: z.string(),
                request_id: z.string(),
              }),
            }),
          },
        },
      },
      '400': { description: 'Corp JSON invalid' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true });
  }
}

// ── 14. POST /webhook/whatsapp — WhatsApp message webhook ────────────────────

const WhatsAppWebhookSchema = z.object({
  object: z.string().describe('Trebuie sa fie "whatsapp_business_account"'),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.string(),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          type: z.literal('text'),
          text: z.object({ body: z.string() }),
          context: z.object({
            forwarded: z.boolean().optional(),
            frequently_forwarded: z.boolean().optional(),
          }).optional(),
        })).optional(),
      }),
      field: z.string(),
    })),
  })),
});

export class WhatsAppWebhookEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Webhooks'],
    summary: 'Webhook WhatsApp Cloud API',
    description: 'Primeste mesaje de la WhatsApp Cloud API. Suporta analiza automata a mesajelor suspecte, comenzi GDPR (START/STERGE/STOP), si mesaje redirectionate. Verificarea se face prin HMAC-SHA256 (x-hub-signature-256).',
    request: {
      headers: z.object({
        'x-hub-signature-256': z.string().optional().describe('HMAC-SHA256 signature (sha256=...) — verificat cand WHATSAPP_APP_SECRET este configurat'),
      }),
      body: {
        content: {
          'application/json': {
            schema: WhatsAppWebhookSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Mesaje procesate',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
      '401': {
        description: 'Semnatura HMAC invalida',
        content: {
          'application/json': {
            schema: z.object({
              error: z.object({
                code: z.string(),
                message: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true });
  }
}

// ── 15. POST /content/webhook — Sanity CMS cache invalidation ────────────────

export class ContentWebhookEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Webhooks'],
    summary: 'Cache invalidation Sanity CMS',
    description: 'Primeste notificari de la Sanity CMS la publicarea/modificarea continutului. Invalideaza cache-ul KV pentru toate categoriile de continut (amenintari, ghid, educatie, rapoarte, povesti, presa). Verificarea se face prin headerul sanity-webhook-signature.',
    request: {
      headers: z.object({
        'sanity-webhook-signature': z.string().optional().describe('Secret de verificare configurat in Sanity'),
      }),
    },
    responses: {
      '200': {
        description: 'Cache invalidat',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
      '401': {
        description: 'Semnatura invalida',
      },
      '500': {
        description: 'Eroare la invalidarea cache-ului',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true });
  }
}

// ── 16. GET /gepa/evaluations — GEPA benchmark results ───────────────────────

const GepaEvaluationSchema = z.object({
  category: z.string(),
  count: z.number(),
  evaluations: z.array(z.object({
    prompt: z.string().optional(),
    score: z.number().optional(),
    timestamp: z.string().optional(),
  }).passthrough()),
});

export class GepaEvaluationsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['GEPA Benchmark'],
    summary: 'Rezultate evaluari GEPA',
    description: 'Returneaza istoricul evaluarilor GEPA (Grija Evaluation of Prompt Accuracy) pentru o categorie data. Necesita headerul x-admin-api-key.',
    request: {
      headers: z.object({
        'x-admin-api-key': z.string().describe('Cheia API de admin pentru acces'),
      }),
      query: z.object({
        category: z.string().describe('Categoria de evaluare (obligatoriu)'),
      }),
    },
    responses: {
      '200': {
        description: 'Evaluari GEPA',
        content: {
          'application/json': {
            schema: GepaEvaluationSchema,
          },
        },
      },
      '400': {
        description: 'Parametrul category lipseste',
      },
      '401': {
        description: 'Cheie API invalida',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ category: '', count: 0, evaluations: [] });
  }
}
