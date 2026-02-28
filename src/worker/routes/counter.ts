import { Hono } from 'hono';
import type { Env } from '../lib/types';

const counter = new Hono<{ Bindings: Env }>();

counter.get('/api/counter', async (c) => {
  const key = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(key) || '0');
  return c.json({ total_checks: current });
});

export { counter };
