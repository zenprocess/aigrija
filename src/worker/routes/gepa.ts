import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { getPromptHistory } from '../lib/gepa-benchmark';

export const gepa = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /gepa/evaluations?category=<category>
 * Admin endpoint: list all GEPA evaluations for a given category.
 * Requires ADMIN_API_KEY header for access.
 */
gepa.get('/gepa/evaluations', async (c) => {
  const apiKey = c.req.header('x-admin-api-key');
  if (!apiKey || apiKey !== c.env.ADMIN_API_KEY) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Acces interzis.' } }, 401);
  }

  const category = c.req.query('category');
  if (!category) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Parametrul category este obligatoriu.' } },
      400,
    );
  }

  const evaluations = await getPromptHistory(c.env, category);
  return c.json({ category, count: evaluations.length, evaluations });
});
