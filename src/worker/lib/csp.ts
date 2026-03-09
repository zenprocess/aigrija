import type { MiddlewareHandler } from 'hono';

/**
 * CSP policy for public SSR pages (alerte, policies, gdpr, og, card).
 * Allows Umami analytics script and inline styles (Tailwind CDN runtime).
 */
export const PUBLIC_CSP =
  "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self';";

/**
 * CSP policy for the admin panel (HTML-over-the-wire with htmx + build-time Tailwind CSS).
 * Allows inline scripts (htmx handlers) and cdn.ai-grija.ro images.
 */
export const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cdn.ai-grija.ro",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * CSP policy used by the global securityHeaders() middleware.
 * Admin variant includes CDN script sources; public variant is locked down.
 */
export const SECURITY_HEADERS_ADMIN_CSP =
  "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export const SECURITY_HEADERS_PUBLIC_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/**
 * Hono middleware that sets Content-Security-Policy on all responses.
 */
export function cspMiddleware(policy: string): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.set('Content-Security-Policy', policy);
  };
}

/**
 * Hono middleware that sets Content-Security-Policy only on HTML responses.
 */
export function cspHtmlMiddleware(policy: string): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const ct = c.res.headers.get('Content-Type') ?? '';
    if (ct.includes('text/html')) {
      c.res.headers.set('Content-Security-Policy', policy);
    }
  };
}
