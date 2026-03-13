import * as Sentry from '@sentry/cloudflare';
import { Hono } from 'hono';
import type { Env } from './lib/types';
import type { AppVariables } from './lib/request-id';
import { applyMiddleware } from './middleware/chain';
import { registerRoutes } from './routes/registry';
import { cdnProtection } from './middleware/cdn-protection';
import { admin } from './admin';
import { handleScheduled } from './lib/cron-handler';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

applyMiddleware(app);
registerRoutes(app);

const mainFetch = app.fetch.bind(app);

// CDN host — apply WAF-like protection middleware for all R2 asset routes
const cdnApp = new Hono<{ Bindings: Env; Variables: AppVariables }>();
cdnApp.use('*', cdnProtection);
cdnApp.all('*', (c) => mainFetch(c.req.raw, c.env, c.executionCtx));

const workerHandler = {
  fetch: async function(request: Request, env: Parameters<typeof app.fetch>[1], ctx: ExecutionContext) {
    const url = new URL(request.url);
    const host = url.hostname;
    const isCdnHost = host === 'cdn.ai-grija.ro' || host === 'pre-cdn.ai-grija.ro';
    if (isCdnHost) {
      return cdnApp.fetch(request, env, ctx);
    }
    const isAdminHost = host === 'admin.ai-grija.ro' ||
      host === 'pre-admin.ai-grija.ro' ||
      (host === 'localhost' && url.pathname.startsWith('/admin'));
    if (isAdminHost) {
      if (url.pathname.startsWith('/admin')) {
        const adminUrl = new URL(request.url);
        adminUrl.pathname = adminUrl.pathname.replace(/^\/admin/, '') || '/';
        return admin.fetch(new Request(adminUrl.toString(), request), env, ctx);
      }
      return admin.fetch(request, env, ctx);
    }
    return mainFetch(request, env, ctx);
  },
  // Expose Hono test helper for unit tests
  request: app.request.bind(app),
  async scheduled(event: ScheduledEvent, env: Parameters<typeof app.fetch>[1], ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env as Env));
  },
};

export default Sentry.withSentry(
  (env: Env) => ({ dsn: env.SENTRY_DSN || '', tracesSampleRate: 1.0 }),
  workerHandler,
);
