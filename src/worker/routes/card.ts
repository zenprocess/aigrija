import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { escapeHtml } from '../lib/escape-html';

const card = new Hono<{ Bindings: Env }>();

interface CardMeta {
  verdict: string;
  scam_type: string;
}


card.get('/card/:hash/image', async (c) => {
  const hash = c.req.param('hash');
  const obj = await c.env.STORAGE.get(`cards/${hash}.svg`);
  if (!obj) {
    const rid = (c.get('requestId' as never) as string) || 'unknown';
    return c.json({ error: { code: 'NOT_FOUND', message: 'Imaginea cardului nu a fost gasita.' }, request_id: rid }, 404);
  }
  const svg = await obj.text();
  return c.text(svg, 200, { 'Content-Type': 'image/svg+xml' });
});

card.get('/card/:hash', async (c) => {
  const hash = c.req.param('hash');
  const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
  const raw = await c.env.CACHE.get(`cards:meta:${hash}`);
  let meta: CardMeta = { verdict: 'safe', scam_type: 'unknown' };
  if (raw) {
    try {
      meta = JSON.parse(raw) as CardMeta;
    } catch {
      // use defaults
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
