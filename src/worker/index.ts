import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
