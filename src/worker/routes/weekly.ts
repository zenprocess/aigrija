import { Hono } from 'hono';
import type { Env } from '../lib/types';

const weekly = new Hono<{ Bindings: Env }>();

weekly.get('/api/weekly', async (c) => {
  return c.json({ ok: true, items: [] });
});

export { weekly };
