import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { generateReport, type ReportType, type ReportParams } from '../lib/report-templates';
import { checkRateLimit } from '../lib/rate-limiter';

const report = new Hono<{ Bindings: Env }>();

const VALID_TYPES: ReportType[] = ['plangere-penala', 'petitie-politie', 'raport-dnsc', 'sesizare-banca'];

report.get('/api/report/:type', async (c) => {
  const ip = c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';

  const { allowed, remaining, limit } = await checkRateLimit(c.env.CACHE, `report:${ip}`, 100);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    c.header('Retry-After', '3600');
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.' } }, 429);
  }

  const type = c.req.param('type') as ReportType;

  if (!VALID_TYPES.includes(type)) {
    return c.json({
      error: {
        code: 'INVALID_REPORT_TYPE',
        message: `Tip de raport invalid. Tipuri acceptate: ${VALID_TYPES.join(', ')}`,
      },
    }, 400);
  }

  const scam_type = c.req.query('scam_type') || 'fraudă online';
  const rawText = c.req.query('text') || '';
  const text_excerpt = rawText.slice(0, 200);
  const url = c.req.query('url') || undefined;
  const bank_name = c.req.query('bank') || undefined;
  const verdict = c.req.query('verdict') || 'suspicious';
  const date = c.req.query('date') || new Date().toLocaleDateString('ro-RO');

  const params: ReportParams = { scam_type, text_excerpt, date, url, bank_name, verdict };
  const result = generateReport(type, params);

  return c.json({ ...result, zen_labs_credit: 'ai-grija.ro — Proiect civic Zen Labs' });
});

export { report };
