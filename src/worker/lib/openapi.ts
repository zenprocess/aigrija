import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import type { Env } from './types';
import type { AppVariables } from './request-id';

export function createOpenAPIApp(app: Hono<{ Bindings: Env; Variables: AppVariables }>) {
  return fromHono(app, {
    docs_url: '/docs',
    schema: {
      info: {
        title: 'AI Grija API',
        version: '1.0.0',
        description: 'Romanian anti-phishing API — verifica mesaje si URL-uri suspecte',
      },
    },
  });
}
