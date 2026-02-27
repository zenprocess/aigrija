import { Hono } from 'hono';
import type { Env } from '../lib/types';

const counter = new Hono<{ Bindings: Env }>();

counter.post('/api/counter', async (c) => {
  const key = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(key) || '0');
  await c.env.CACHE.put(key, String(current + 1));
  return c.json({ total_checks: current + 1 });
});

counter.get('/api/counter', async (c) => {
  const key = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(key) || '0');
  return c.json({ total_checks: current });
});

export { counter };
