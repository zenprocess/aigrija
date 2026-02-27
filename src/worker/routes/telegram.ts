import { Hono } from 'hono';
import type { Env } from '../lib/types';

const telegram = new Hono<{ Bindings: Env }>();

telegram.post('/webhook/telegram', async (c) => {
  // Verify Telegram secret token (#7)
  const secret = c.req.header('x-telegram-bot-api-secret-token');
  if (!secret || secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // TODO: Parse update, classify message, respond
  return c.json({ ok: true });
});

export { telegram };
