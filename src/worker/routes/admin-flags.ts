import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { getFlag, setFlag, FLAG_DEFAULTS, type FeatureFlag } from '../lib/feature-flags';

const adminFlags = new Hono<{ Bindings: Env }>();

// GET /api/admin/flags — list all feature flags with current values
adminFlags.get('/api/admin/flags', async (c) => {
  const flags: Record<string, boolean> = {};
  for (const [flag, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
    flags[flag] = await getFlag(c.env, flag as FeatureFlag, defaultValue);
  }
  return c.json({ flags });
});

// POST /api/admin/flags/:name — set a feature flag value
adminFlags.post('/api/admin/flags/:name', async (c) => {
  const name = c.req.param('name');
  let body: { enabled: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body. Expected { "enabled": true|false }' }, 400);
  }
  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'Field "enabled" must be a boolean' }, 400);
  }
  await setFlag(c.env, name, body.enabled);
  return c.json({ flag: name, enabled: body.enabled });
});

export { adminFlags };
