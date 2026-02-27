import { Hono } from 'hono';
import type { Env } from '../lib/types';

const whatsapp = new Hono<{ Bindings: Env }>();

whatsapp.get('/webhook/whatsapp', (c) => {
  // WhatsApp verification challenge
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return c.text('Forbidden', 403);
});

whatsapp.post('/webhook/whatsapp', async (c) => {
  // TODO: Implement WhatsApp Cloud API webhook handler
  return c.json({ ok: true });
});

export { whatsapp };
