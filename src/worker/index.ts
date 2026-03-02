import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './lib/types';
import type { AppVariables } from './lib/request-id';
import { requestId } from './lib/request-id';
import { structuredLog } from './lib/logger';
import { counter } from './routes/counter';
import { alerts } from './routes/alerts';
import { share } from './routes/share';
import { sitemap } from './routes/sitemap';
import { seo } from './routes/seo';
import { telegram } from './routes/telegram';
import { whatsapp } from './routes/whatsapp';
import { report } from './routes/report';
import { community } from './routes/community';
import { og } from './routes/og';
import { upload } from './routes/upload';
import { checkQr } from './routes/check-qr';
import { adminFlags } from './routes/admin-flags';
import { blog } from './routes/blog';
import { policies } from './routes/policies';
import { card } from './routes/card';
import { feed } from './routes/feed';
import { weekly } from './routes/weekly';
import { reportGenerator } from './routes/report-generator';
import { metrics } from './routes/metrics';
import { quiz } from './routes/quiz';
import { translationReport } from './routes/translation-report';
import { newsletter } from './routes/newsletter';
import { gepa } from './routes/gepa';
import { handleScheduled } from './lib/cron-handler';
import { cdnProtection } from './middleware/cdn-protection';
import { admin } from './admin';
import { createOpenAPIApp } from './lib/openapi';
import { CheckEndpoint } from './routes/openapi-check';
import { AlertsEndpoint } from './routes/openapi-alerts';
import { HealthEndpoint } from './routes/openapi-health';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Request ID on all routes
app.use('*', requestId);

// Structured logging middleware — log request start and end with duration
app.use('*', async (c, next) => {
  const rid = c.get('requestId');
  const start = Date.now();
  structuredLog('info', 'request_start', {
    request_id: rid,
    stage: 'request',
    method: c.req.method,
    path: c.req.path,
  });
  await next();
  structuredLog('info', 'request_end', {
    request_id: rid,
    stage: 'response',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration_ms: Date.now() - start,
  });
});

// Global error handler
app.onError((err, c) => {
  const rid = c.get('requestId') || crypto.randomUUID();
  structuredLog('error', 'unhandled_error', {
    request_id: rid,
    stage: 'error',
    method: c.req.method,
    path: c.req.path,
    error: err.message,
    stack: err.stack,
  });
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Eroare interna. Va rugam incercati din nou.', request_id: rid } }, 500);
});

// Security headers for SSR pages
app.use('/alerte/*', secureHeaders());
app.use('/alerte', secureHeaders());

// Content-Security-Policy for SSR pages
const CSP_VALUE = "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self';";
app.use('/alerte/*', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});
app.use('/alerte', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});
app.use('/policies/*', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});
app.use('/gdpr', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});
app.use('/og/*', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});
app.use('/card/*', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP_VALUE);
});

// CORS only on public API routes
app.use('/api/*', cors({
  origin: ['https://ai-grija.ro', 'https://www.ai-grija.ro', 'https://pre.ai-grija.ro', 'https://admin.ai-grija.ro'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 86400,
}));

// Wrap with chanfana for OpenAPI docs at /docs
const openapi = createOpenAPIApp(app);

// OpenAPI-documented routes
openapi.post('/api/check', CheckEndpoint);
openapi.get('/api/alerts', AlertsEndpoint);
openapi.get('/health', HealthEndpoint);

// Admin feature flag routes
app.route('/', adminFlags);

// Plain Hono routes (no OpenAPI docs needed)
app.route('/', counter);
app.route('/', alerts);   // keeps /alerte SSR + legacy /api/alerts (chanfana takes priority)
app.route('/', share);
app.route('/', sitemap);
app.route('/', seo);
app.route('/', telegram);
app.route('/', whatsapp);
app.route('/', report);
app.route('/', community);
app.route('/', og);
app.route('/', upload);
app.route('/', checkQr);
app.route('/', blog);
app.route('/', policies);
app.route('/', card);
app.route('/', feed);
app.route('/', weekly);
app.route('/', reportGenerator);
app.route('/', metrics);
app.route('/', quiz);
app.route('/', translationReport);
app.route('/', newsletter);
app.route('/', gepa);

// Asset fallback: for any route not matched by Hono, try the ASSETS binding.
// This is required because run_worker_first = true intercepts all requests before
// Cloudflare's asset handler, so static files (index.html, JS, CSS, etc.) would
// otherwise return 404.
app.notFound(async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  if (response.status !== 404) {
    return response;
  }
  const rid = c.get('requestId') || 'unknown';
  return c.json({ error: { code: 'NOT_FOUND', message: 'Pagina nu a fost gasita.' }, request_id: rid }, 404);
});

// Admin host routing
// Requests from admin.ai-grija.ro are handled by the admin app
// On localhost, requests to /admin/* are also routed to the admin app
const mainFetch = app.fetch.bind(app);

// CDN host — apply WAF-like protection middleware for all R2 asset routes
const cdnApp = new Hono<{ Bindings: Env; Variables: AppVariables }>();
cdnApp.use('*', cdnProtection);
// Pass through to main app for actual R2 asset serving (share route)
cdnApp.all('*', (c) => mainFetch(c.req.raw, c.env, c.executionCtx));

const workerHandler = {
  fetch: async function(request: Request, env: Parameters<typeof app.fetch>[1], ctx: ExecutionContext) {
    const url = new URL(request.url);
    const host = url.hostname;
    const isCdnHost = host === 'cdn.ai-grija.ro' || host === 'pre-cdn.ai-grija.ro';
    if (isCdnHost) {
      return cdnApp.fetch(request, env, ctx);
    }
    const isAdminHost = host === 'admin.ai-grija.ro' ||
      host === 'pre-admin.ai-grija.ro' ||
      (host === 'localhost' && url.pathname.startsWith('/admin'));
    if (isAdminHost) {
      if (host === 'localhost') {
        // Strip /admin prefix for local dev routing
        const adminUrl = new URL(request.url);
        adminUrl.pathname = adminUrl.pathname.replace(/^\/admin/, '') || '/';
        return admin.fetch(new Request(adminUrl.toString(), request), env, ctx);
      }
      // admin.ai-grija.ro / pre-admin.ai-grija.ro — pass through as-is
      return admin.fetch(request, env, ctx);
    }
    return mainFetch(request, env, ctx);
  },
  // Expose Hono test helper for unit tests
  request: app.request.bind(app),
  async scheduled(event: ScheduledEvent, env: Parameters<typeof app.fetch>[1], ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env as Env));
  },
};

export default workerHandler;
