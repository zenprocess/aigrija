import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './lib/types';
import { requestId } from './lib/request-id';
import { counter } from './routes/counter';
import { alerts } from './routes/alerts';
import { share } from './routes/share';
import { sitemap } from './routes/sitemap';
import { telegram } from './routes/telegram';
import { whatsapp } from './routes/whatsapp';
import { report } from './routes/report';
import { og } from './routes/og';
import { upload } from './routes/upload';
import { createOpenAPIApp } from './lib/openapi';
import { CheckEndpoint } from './routes/openapi-check';
import { AlertsEndpoint } from './routes/openapi-alerts';
import { HealthEndpoint } from './routes/openapi-health';

const app = new Hono<{ Bindings: Env }>();

// Request ID on all routes
app.use('*', requestId);

// Global error handler
app.onError((err, c) => {
  const rid = c.get('requestId' as never) as string || crypto.randomUUID();
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);
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

// Plain Hono routes (no OpenAPI docs needed)
app.route('/', counter);
app.route('/', alerts);   // keeps /alerte SSR + legacy /api/alerts (chanfana takes priority)
app.route('/', share);
app.route('/', sitemap);
app.route('/', telegram);
app.route('/', whatsapp);
app.route('/', report);
app.route('/', og);
app.route('/', upload);

export default app;
