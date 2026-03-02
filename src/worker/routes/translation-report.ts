import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit, applyRateLimitHeaders } from '../lib/rate-limiter';
import { idempotency } from '../middleware/idempotency';

const translationReport = new Hono<{ Bindings: Env }>();

interface TranslationReportBody {
  lang: string;
  key?: string;
  currentText?: string;
  suggestedText?: string;
  comment: string;
  page?: string;
}

translationReport.post('/api/translation-report', idempotency(), async (c) => {
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const rl = await checkRateLimit(c.env.CACHE, `translation-report:${ip}`, 5, 3600);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);

  if (!rl.allowed) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Prea multe rapoarte. Incearca din nou mai tarziu.' } },
      429,
    );
  }

  let body: TranslationReportBody;
  try {
    body = await c.req.json<TranslationReportBody>();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Corp de cerere invalid.' } }, 400);
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere lipsa.' } }, 400);
  }

  if (!body.comment || typeof body.comment !== 'string' || body.comment.trim().length === 0) {
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
    lang: body.lang.slice(0, 10),
    key: body.key?.slice(0, 200) ?? null,
    currentText: body.currentText?.slice(0, 1000) ?? null,
    suggestedText: body.suggestedText?.slice(0, 1000) ?? null,
    comment: body.comment.trim().slice(0, 2000),
    page: body.page?.slice(0, 200) ?? null,
    ip,
  };

  await c.env.CACHE.put(kvKey, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 90 });

  return c.json({ ok: true, id });
});

export { translationReport };
