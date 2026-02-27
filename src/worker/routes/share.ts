import { Hono } from 'hono';
import type { Env } from '../lib/types';

const share = new Hono<{ Bindings: Env }>();

share.get('/api/share/:id', async (c) => {
  const id = c.req.param('id');
  const obj = await c.env.STORAGE.get(`share/${id}.png`);
  if (!obj) {
    return c.json({ error: 'Share card not found.' }, 404);
  }
  const headers = new Headers();
  headers.set('Content-Type', 'image/png');
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
});

export { share };
