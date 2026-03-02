import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit, applyRateLimitHeaders } from '../lib/rate-limiter';

const TranslationReportRequestSchema = z.object({
  lang: z.string().min(1).max(10).describe('Codul limbii (ex: ro, en, bg)'),
  key: z.string().max(200).optional().describe('Cheia de traducere afectata'),
  currentText: z.string().max(1000).optional().describe('Textul curent (gresit)'),
  suggestedText: z.string().max(1000).optional().describe('Textul sugerat (corect)'),
  comment: z.string().min(1).max(2000).describe('Comentariul sau descrierea erorii'),
  page: z.string().max(200).optional().describe('Pagina unde a fost gasita eroarea'),
});

const TranslationReportResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string().describe('ID-ul raportului creat'),
});

export class TranslationReportEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Feedback'],
    summary: 'Raporteaza o eroare de traducere',
    description: 'Trimite un raport pentru o eroare de traducere gasita pe platforma. Rate limit: 5 rapoarte/ora per IP.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: TranslationReportRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Raport inregistrat cu succes',
        content: {
          'application/json': {
            schema: TranslationReportResponseSchema,
          },
        },
      },
      '400': {
        description: 'Date invalide (camp obligatoriu lipsa)',
      },
      '429': {
        description: 'Prea multe rapoarte',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const rl = await checkRateLimit(c.env.CACHE, `translation-report:${ip}`, 5, 3600);
    applyRateLimitHeaders((k, v) => c.header(k, v), rl);

    if (!rl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe rapoarte. Incearca din nou mai tarziu.' } }, 429);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'INVALID_JSON', message: 'Corp de cerere invalid.' } }, 400);
    }

    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere lipsa.' } }, 400);
    }

    if (!body.comment || typeof body.comment !== 'string' || (body.comment as string).trim().length === 0) {
      return c.json({ error: { code: 'MISSING_COMMENT', message: 'Campul "comment" este obligatoriu.' } }, 400);
    }

    if (!body.lang || typeof body.lang !== 'string') {
      return c.json({ error: { code: 'MISSING_LANG', message: 'Campul "lang" este obligatoriu.' } }, 400);
    }

    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const kvKey = `translation-report:${timestamp}:${id}`;

    const record = {
      id,
      timestamp,
      lang: (body.lang as string).slice(0, 10),
      key: (body.key as string | undefined)?.slice(0, 200) ?? null,
      currentText: (body.currentText as string | undefined)?.slice(0, 1000) ?? null,
      suggestedText: (body.suggestedText as string | undefined)?.slice(0, 1000) ?? null,
      comment: (body.comment as string).trim().slice(0, 2000),
      page: (body.page as string | undefined)?.slice(0, 200) ?? null,
      ip,
    };

    await c.env.CACHE.put(kvKey, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 90 });

    return c.json({ ok: true, id });
  }
}
