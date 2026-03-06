import type { MiddlewareHandler } from 'hono';
import type { Env } from './types';
import { SECURITY_HEADERS_ADMIN_CSP, SECURITY_HEADERS_PUBLIC_CSP } from './csp';

const DEFAULT_CORS_ORIGINS = ['https://ai-grija.ro', 'https://admin.ai-grija.ro'];

function getAllowedOrigins(env: Env | undefined): string[] {
  if (env?.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_CORS_ORIGINS;
}

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    const isAdmin = c.req.url.includes('admin.');

    c.header(
      'Content-Security-Policy',
      isAdmin ? SECURITY_HEADERS_ADMIN_CSP : SECURITY_HEADERS_PUBLIC_CSP
    );
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    const origin = c.req.header('Origin');
    const allowed = getAllowedOrigins(c.env as Env | undefined);
    if (origin && allowed.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
  };
}
