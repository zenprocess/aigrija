import { Hono } from 'hono';
import type { Env } from '../lib/types';

const telegram = new Hono<{ Bindings: Env }>();

telegram.post('/webhook/telegram', async (c) => {
  // TODO: Implement Telegram bot webhook handler
  // Verify token, parse update, classify message, respond
  return c.json({ ok: true });
});

export { telegram };
