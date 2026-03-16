import * as Sentry from '@sentry/cloudflare';
import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { requestId } from '../lib/request-id';
import { structuredLog } from '../lib/logger';
import { cspMiddleware, cspHtmlMiddleware, PUBLIC_CSP, SECURITY_HEADERS_PUBLIC_CSP } from '../lib/csp';
import { renderErrorPage } from '../lib/error-pages';

type AppType = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function applyMiddleware(app: AppType): void {
  // Request ID on all routes
  app.use('*', requestId);

  // Expose app.fetch via context so deep health can route internally
  app.use('*', async (c, next) => {
    c.set('appFetch', async (req: Request) => app.fetch(req, c.env as any, c.executionCtx));
    await next();
  });

  // Structured logging middleware — log request start and end with duration
  app.use('*', async (c, next) => {
    const rid = c.get('requestId');
    const start = Date.now();
    structuredLog('info', 'request_start', {
      request_id: rid,
      stage: 'request',
      method: c.req.method,
      path: c.req.path,
    });
    await next();
    structuredLog('info', 'request_end', {
      request_id: rid,
      stage: 'response',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: Date.now() - start,
    });
  });

  // Global error handler
  app.onError((err, c) => {
    const rid = c.get('requestId') || crypto.randomUUID();
    Sentry.captureException(err);
    structuredLog('error', 'unhandled_error', {
      request_id: rid,
      stage: 'error',
      method: c.req.method,
      path: c.req.path,
      error: err.message,
      stack: err.stack,
    });
    const accept = c.req.header('Accept') || '';
    if (accept.includes('text/html') && !accept.includes('application/json')) {
      return c.html(renderErrorPage(500, err.message, rid), 500);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Eroare interna. Va rugam incercati din nou.', request_id: rid } }, 500);
  });

  // Security headers on all routes
  app.use('*', secureHeaders());

  // Default CSP on all HTML responses (SPA shell, error pages)
  app.use('*', cspHtmlMiddleware(SECURITY_HEADERS_PUBLIC_CSP));

  // Stricter CSP for SSR pages with nonce support — overrides the default above
  const publicCsp = cspMiddleware(PUBLIC_CSP);
  app.use('/alerte/*', publicCsp);
  app.use('/alerte', publicCsp);
  app.use('/policies/*', publicCsp);
  app.use('/gdpr', publicCsp);
  app.use('/og/*', publicCsp);
  app.use('/card/*', publicCsp);

  // CORS only on public API routes
  app.use('/api/*', cors({
    origin: ['https://ai-grija.ro', 'https://www.ai-grija.ro', 'https://pre.ai-grija.ro', 'https://admin.ai-grija.ro'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    maxAge: 86400,
  }));
}
