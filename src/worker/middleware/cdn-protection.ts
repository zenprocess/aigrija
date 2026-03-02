/**
 * CDN Protection Middleware
 *
 * WAF-like protection for cdn.ai-grija.ro R2 asset routes.
 * Enforces method restrictions, hotlink protection, and security headers.
 */

import type { MiddlewareHandler } from 'hono';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ALLOWED_REFERER_ORIGINS = [
  'https://ai-grija.ro',
  'https://www.ai-grija.ro',
  'https://admin.ai-grija.ro',
  'https://pre.ai-grija.ro',
  'https://cdn.ai-grija.ro',
];

const CRAWLER_UA_PATTERNS = [
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'applebot',
  'ia_archiver',
];

function isAllowedReferer(referer: string | undefined): boolean {
  if (!referer) return true;
  for (const origin of ALLOWED_REFERER_ORIGINS) {
    if (referer.startsWith(origin)) return true;
  }
  return false;
}

function isCrawlerUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_UA_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/');
}

export const cdnProtection: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    c.header('Allow', 'GET, HEAD, OPTIONS');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.text('Method Not Allowed', 405);
  }

  const referer = c.req.header('Referer') ?? c.req.header('referer');
  const userAgent = c.req.header('User-Agent');

  if (!isCrawlerUserAgent(userAgent) && !isAllowedReferer(referer)) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.text('Forbidden', 403);
  }

  await next();

  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('X-Content-Type-Options', 'nosniff');

  const responseContentType = c.res.headers.get('Content-Type');
  if (!isImageContentType(responseContentType)) {
    c.header('X-Frame-Options', 'DENY');
  }
};
