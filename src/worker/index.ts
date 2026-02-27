import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './lib/types';
import { health } from './routes/health';
import { counter } from './routes/counter';
import { check } from './routes/check';
import { alerts } from './routes/alerts';
import { share } from './routes/share';
import { sitemap } from './routes/sitemap';
import { telegram } from './routes/telegram';
import { whatsapp } from './routes/whatsapp';

const app = new Hono<{ Bindings: Env }>();

// Global error handler (#1)
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json({ error: 'Eroare interna. Va rugam incercati din nou.' }, 500);
});

// Security headers for SSR pages (#5)
app.use('/alerte/*', secureHeaders());
app.use('/alerte', secureHeaders());

// CORS only on public API routes, not webhooks (#8)
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
