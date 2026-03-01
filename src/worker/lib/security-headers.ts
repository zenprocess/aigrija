import type { MiddlewareHandler } from 'hono';

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    const isAdmin = c.req.url.includes('admin.');

    c.header(
      'Content-Security-Policy',
      isAdmin
        // CDN dependencies (htmx, tailwind) require unsafe-inline for styles and external script-src
        ? "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        // Tailwind (CDN build) injects styles at runtime — unsafe-inline required until a build step is added
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    const origin = c.req.header('Origin');
    const allowed = ['https://ai-grija.ro', 'https://admin.ai-grija.ro'];
    if (origin && allowed.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
  };
}
