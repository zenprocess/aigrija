import { Hono } from 'hono';
import type { Env } from '../lib/types';

const counter = new Hono<{ Bindings: Env }>();

counter.get('/api/counter', async (c) => {
  const key = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(key) || '0');
  return c.json({ total_checks: current });
});

counter.post('/api/counter', async (c) => {
  const authHeader = c.req.header('Authorization');
  const adminKey = c.env.ADMIN_API_KEY;
  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Acces interzis. Cheia API este invalida.' } }, 401);
  }
  const key = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(key) || '0');
  const updated = current + 1;
  await c.env.CACHE.put(key, String(updated));
  return c.json({ total_checks: updated });
});

export { counter };
