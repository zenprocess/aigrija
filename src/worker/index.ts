import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './lib/types';
import { requestId } from './lib/request-id';
import { health } from './routes/health';
import { counter } from './routes/counter';
import { check } from './routes/check';
import { alerts } from './routes/alerts';
import { share } from './routes/share';
import { sitemap } from './routes/sitemap';
import { telegram } from './routes/telegram';
import { whatsapp } from './routes/whatsapp';

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

app.route('/', health);
app.route('/', counter);
app.route('/', check);
app.route('/', alerts);
app.route('/', share);
app.route('/', sitemap);
app.route('/', telegram);
app.route('/', whatsapp);

export default app;
