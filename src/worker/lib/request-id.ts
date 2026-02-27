import type { Context, Next } from 'hono';

export type AppVariables = { requestId: string };

export async function requestId(c: Context, next: Next) {
  const id = crypto.randomUUID();
  c.set('requestId' as never, id as never);
  c.header('X-Request-Id', id);
  await next();
}
