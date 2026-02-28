import { Hono } from 'hono';
import type { Env } from '../lib/types';

const share = new Hono<{ Bindings: Env }>();

share.get('/api/share/:id', async (c) => {
  const id = c.req.param('id');

  // Try SVG first (new format), fall back to PNG (legacy)
  let obj = await c.env.STORAGE.get(`share/${id}.svg`);
  if (obj) {
    const headers = new Headers();
    headers.set('Content-Type', 'image/svg+xml');
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(obj.body, { headers });
  }

  obj = await c.env.STORAGE.get(`share/${id}.png`);
  if (obj) {
    const headers = new Headers();
    headers.set('Content-Type', 'image/png');
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(obj.body, { headers });
  }

  return c.json({ error: 'Share card not found.' }, 404);
});

export { share };
