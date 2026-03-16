import type { MiddlewareHandler } from 'hono';

/**
 * Hono context variables for CSP nonce.
 * Merge with AppVariables to use: type MyVars = AppVariables & CspVariables
 */
export type CspVariables = {
  cspNonce: string;
};

/**
 * Generates a cryptographically random nonce for use in CSP headers.
 * Uses crypto.randomUUID() which is available in Cloudflare Workers.
 */
export function generateNonce(): string {
  return crypto.randomUUID();
}

/**
 * Builds a CSP string with a per-request nonce in script-src.
 * Replaces 'unsafe-inline' with 'nonce-<value>' only in the script-src directive.
 */
export function buildCspWithNonce(base: string, nonce: string): string {
  return base
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim();
      if (trimmed.startsWith('script-src')) {
        return directive.replace("'unsafe-inline'", `'nonce-${nonce}'`);
      }
      return directive;
    })
    .join(';');
}

/**
 * CSP policy for public SSR pages (alerte, policies, gdpr, og, card).
 * Allows Umami analytics script and inline styles (Tailwind CDN runtime).
 */
export const PUBLIC_CSP =
  "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self';";

/**
 * CSP policy for the admin panel (HTML-over-the-wire with htmx + Tailwind CDN).
 * Allows inline scripts (htmx handlers), Tailwind CDN, and cdn.ai-grija.ro images.
 */
export const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com/htmx.org@",
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
  "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export const SECURITY_HEADERS_PUBLIC_CSP =
  "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self' https://cloud.umami.is https://api-gateway.umami.dev; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

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

/**
 * Hono middleware that generates a per-request CSP nonce, stores it in context,
 * and sets the Content-Security-Policy header with 'nonce-<value>' replacing
 * 'unsafe-inline' in script-src. Only applies to HTML responses.
 *
 * Access the nonce in route handlers via: c.get('cspNonce')
 */
export function cspNonceMiddleware(base: string): MiddlewareHandler<{ Variables: CspVariables }> {
  return async (c, next) => {
    const nonce = generateNonce();
    c.set('cspNonce', nonce);
    await next();
    const ct = c.res.headers.get('Content-Type') ?? '';
    if (ct.includes('text/html')) {
      c.res.headers.set('Content-Security-Policy', buildCspWithNonce(base, nonce));
    }
  };
}
