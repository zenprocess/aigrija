import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { getFlag, setFlag, FLAG_DEFAULTS, type FeatureFlag } from '../lib/feature-flags';

const adminFlags = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Auth middleware: require Authorization: Bearer <ADMIN_API_KEY>
adminFlags.use('/api/admin/*', async (c, next) => {
  const rid = (c.get('requestId')) || 'unknown';
  if (!c.env.ADMIN_API_KEY || c.env.ADMIN_API_KEY.trim() === '') {
    return c.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'API de administrare nu este configurat.' }, request_id: rid },
      503
    );
  }
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== c.env.ADMIN_API_KEY) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Acces neautorizat. Cheia API lipseste sau este invalida.' }, request_id: rid },
      401
    );
  }
  return next();
});

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
  const rid = (c.get('requestId')) || 'unknown';
  const name = c.req.param('name');
  let body: { enabled: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: 'INVALID_JSON', message: 'Corp JSON invalid. Se asteapta { "enabled": true|false }.' }, request_id: rid },
      400
    );
  }
  if (typeof body.enabled !== 'boolean') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Campul "enabled" trebuie sa fie boolean (true sau false).' }, request_id: rid },
      400
    );
  }
  await setFlag(c.env, name, body.enabled);
  return c.json({ flag: name, enabled: body.enabled });
});

export { adminFlags };
