import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AdminVariables } from '../lib/admin-auth';
import { listFlags, putFlag, deleteFlag } from '../lib/feature-flags';
import type { FlagValue } from '../lib/feature-flags';

type AdminEnv = { Bindings: Env; Variables: AdminVariables };

const flagsAdmin = new Hono<AdminEnv>();

// GET /flags - list all flags with current state
flagsAdmin.get('/', async (c) => {
  try {
    const flags = await listFlags(c.env);
    return c.json({ ok: true, flags });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ ok: false, error: message }, 500);
  }
});

// PUT /flags/:name - create or update a flag
flagsAdmin.put('/:name', async (c) => {
  const name = c.req.param('name');
  if (!name || !/^[a-z0-9_-]+$/i.test(name)) {
    return c.json({ ok: false, error: 'Invalid flag name' }, 400);
  }
  let body: Partial<FlagValue>;
  try {
    body = await c.req.json<Partial<FlagValue>>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }
  if (typeof body.enabled !== 'boolean') {
    return c.json({ ok: false, error: 'Field "enabled" (boolean) is required' }, 400);
  }
  if (body.percentage !== undefined && (body.percentage < 0 || body.percentage > 100)) {
    return c.json({ ok: false, error: 'percentage must be 0-100' }, 400);
  }
  const flag: FlagValue = {
    enabled: body.enabled,
    ...(body.percentage !== undefined ? { percentage: body.percentage } : {}),
    ...(Array.isArray(body.cohorts) ? { cohorts: body.cohorts } : {}),
  };
  await putFlag(c.env, name, flag);
  return c.json({ ok: true, name, flag });
});

// DELETE /flags/:name - remove a flag
flagsAdmin.delete('/:name', async (c) => {
  const name = c.req.param('name');
  await deleteFlag(c.env, name);
  return c.json({ ok: true, name });
});

export { flagsAdmin };
