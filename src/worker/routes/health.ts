import { Hono } from 'hono';
import type { Env } from '../lib/types';

const health = new Hono<{ Bindings: Env }>();

health.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

export { health };
