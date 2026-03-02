import { Hono } from 'hono';
import { generateReport } from '../lib/report-templates';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { ReportTypeSchema, ReportQuerySchema, formatZodError } from '../lib/schemas';
const report = new Hono();
function sanitize(s) {
    return s.replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c] ?? c));
}
report.get('/api/report/:type', async (c) => {
    const ip = c.req.header('cf-connecting-ip')
        || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || c.req.header('x-real-ip')
        || 'unknown';
    const rl = await checkRateLimit(c.env.CACHE, `report:${ip}`, ROUTE_RATE_LIMITS['report'].limit, ROUTE_RATE_LIMITS['report'].windowSeconds);
    applyRateLimitHeaders((k, v) => c.header(k, v), rl);
    const { allowed } = rl;
    if (!allowed) {
        return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.' } }, 429);
    }
    const typeResult = ReportTypeSchema.safeParse(c.req.param('type'));
    if (!typeResult.success) {
        return c.json({
            error: {
                code: 'INVALID_REPORT_TYPE',
                message: formatZodError(typeResult.error),
            },
        }, 400);
    }
    const type = typeResult.data;
    const queryResult = ReportQuerySchema.safeParse({
        scam_type: c.req.query('scam_type'),
        text: c.req.query('text'),
        url: c.req.query('url'),
        bank: c.req.query('bank'),
        verdict: c.req.query('verdict'),
        date: c.req.query('date'),
    });
    if (!queryResult.success) {
        return c.json({
            error: {
                code: 'VALIDATION_ERROR',
                message: formatZodError(queryResult.error),
            },
        }, 400);
    }
    const q = queryResult.data;
    const scam_type = sanitize(q.scam_type);
    const text_excerpt = sanitize(q.text).slice(0, 200);
    const url = q.url ? sanitize(q.url) : undefined;
    const bank_name = q.bank ? sanitize(q.bank) : undefined;
    const verdict = sanitize(q.verdict);
    const date = q.date || new Date().toLocaleDateString('ro-RO');
    const params = { scam_type, text_excerpt, date, url, bank_name, verdict };
    const result = generateReport(type, params);
    return c.json({ ...result, zen_labs_credit: 'ai-grija.ro — Proiect civic Zen Labs' });
});
export { report };
