import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './lib/types';
import { requestId } from './lib/request-id';
import { structuredLog } from './lib/logger';
import { counter } from './routes/counter';
import { alerts } from './routes/alerts';
import { share } from './routes/share';
import { sitemap } from './routes/sitemap';
import { telegram } from './routes/telegram';
import { whatsapp } from './routes/whatsapp';
import { report } from './routes/report';
import { community } from './routes/community';
import { og } from './routes/og';
import { upload } from './routes/upload';
import { checkQr } from './routes/check-qr';
import { adminFlags } from './routes/admin-flags';
import { blog } from './routes/blog';
import { campaignsRouter } from './admin/campaigns';
import { handleScheduled } from './lib/cron-handler';
import { admin } from './admin';
import { createOpenAPIApp } from './lib/openapi';
import { CheckEndpoint } from './routes/openapi-check';
import { AlertsEndpoint } from './routes/openapi-alerts';
import { HealthEndpoint } from './routes/openapi-health';

const app = new Hono<{ Bindings: Env }>();

// Request ID on all routes
app.use('*', requestId);

// Structured logging middleware — log request start and end with duration
app.use('*', async (c, next) => {
  const rid = c.get('requestId' as never) as string;
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
  const rid = c.get('requestId' as never) as string || crypto.randomUUID();
  structuredLog('error', 'unhandled_error', {
    request_id: rid,
    stage: 'error',
    method: c.req.method,
    path: c.req.path,
    error: err.message,
  });
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Eroare interna. Va rugam incercati din nou.', request_id: rid } }, 500);
});

// Security headers for SSR pages
app.use('/alerte/*', secureHeaders());
app.use('/alerte', secureHeaders());

// CORS only on public API routes
app.use('/api/*', cors({ origin: '*' }));

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
app.route('/', telegram);
app.route('/', whatsapp);
app.route('/', report);
app.route('/', community);
app.route('/', og);
app.route('/', upload);
app.route('/', checkQr);
app.route('/', blog);
app.route('/', campaignsRouter);

// Admin host routing
// Requests from admin.ai-grija.ro are handled by the admin app
// On localhost, requests to /admin/* are also routed to the admin app
const mainFetch = app.fetch.bind(app);

const workerHandler = {
  fetch: async function(request: Request, env: Parameters<typeof app.fetch>[1], ctx: ExecutionContext) {
    const url = new URL(request.url);
    const host = url.hostname;
    const isAdminHost = host === 'admin.ai-grija.ro' ||
      (host === 'localhost' && url.pathname.startsWith('/admin'));
    if (isAdminHost) {
      const adminReq = host === 'localhost'
        ? request
        : new Request(url.toString().replace(url.pathname, url.pathname.replace(/^\/admin/, '') || '/'), request);
      return admin.fetch(host === 'localhost' ? request : adminReq, env, ctx);
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
