import { Hono } from 'hono';
import { structuredLog } from '../lib/logger';
import { z } from 'zod';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { escapeHtml } from '../lib/escape-html';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';

const CardHashSchema = z.string().min(6, 'Hash prea scurt.').max(128, 'Hash prea lung.');

const card = new Hono<{ Bindings: Env; Variables: AppVariables }>();

interface CardMeta {
  verdict: string;
  scam_type: string;
}


card.get('/card/:hash/image', async (c) => {
  const _hashResult = CardHashSchema.safeParse(c.req.param('hash'));
  if (!_hashResult.success) {
    const rid = (c.get('requestId')) || 'unknown';
    return c.json({ error: { code: 'VALIDATION_ERROR', message: _hashResult.error.issues.map((i: { message: string }) => i.message).join('; ') }, request_id: rid }, 400);
  }
  const hash = _hashResult.data;
  const obj = await c.env.STORAGE.get(`cards/${hash}.svg`);
  if (!obj) {
    const rid = (c.get('requestId')) || 'unknown';
    return c.json({ error: { code: 'NOT_FOUND', message: 'Imaginea cardului nu a fost gasita.' }, request_id: rid }, 404);
  }
  const svg = await obj.text();
  return c.text(svg, 200, { 'Content-Type': 'image/svg+xml' });
});

card.get('/card/:hash', async (c) => {
  const _hashResult2 = CardHashSchema.safeParse(c.req.param('hash'));
  if (!_hashResult2.success) {
    const rid = (c.get('requestId')) || 'unknown';
    return c.json({ error: { code: 'VALIDATION_ERROR', message: _hashResult2.error.issues.map((i: { message: string }) => i.message).join('; ') }, request_id: rid }, 400);
  }
  const hash = _hashResult2.data;
  const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
  const raw = await c.env.CACHE.get(`cards:meta:${hash}`);
  let meta: CardMeta = { verdict: 'safe', scam_type: 'unknown' };
  if (raw) {
    try {
      meta = JSON.parse(raw) as CardMeta;
    } catch (err) {
      structuredLog('error', 'card_meta_parse_error', { error: String(err), hash });
    }
  }

  const verdictUpper = escapeHtml(meta.verdict.toUpperCase());
  const imageUrl = `${baseUrl}/card/${hash}/image`;
  const pageUrl = `${baseUrl}/card/${hash}`;

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="${verdictUpper} - ai-grija.ro">
<meta property="og:image" content="${imageUrl}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:description" content="Verifica mesaje suspecte cu ai-grija.ro">
<title>${verdictUpper} - ai-grija.ro</title>
</head>
<body>
<h1>${verdictUpper}</h1>
<p>Ai primit un mesaj suspect? Verifica-l pe <a href="${baseUrl}">ai-grija.ro</a>.</p>
<p>Tip frauda: ${escapeHtml(meta.scam_type)}</p>
</body>
</html>`;

  return c.html(html);
});

export { card };
