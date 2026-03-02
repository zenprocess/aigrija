/**
 * CDN header utilities for R2-served assets.
 * Implements CORS (#234) and Cache-Control (#235) hardening at the Worker level.
 * R2 bucket CORS cannot be set via S3 API — all enforcement is done here.
 */

const ALLOWED_ORIGINS = new Set([
  'https://ai-grija.ro',
  'https://www.ai-grija.ro',
  'https://cdn.ai-grija.ro',
]);

/**
 * Returns the reflected Origin header value if the origin is in the allowlist,
 * otherwise returns null (header should be omitted).
 */
export function getAllowedOrigin(requestOrigin: string | null | undefined): string | null {
  if (!requestOrigin) return null;
  return ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : null;
}

/**
 * Applies strict CORS headers to a Headers object for R2 asset responses.
 * Only reflects the Origin if it is in the allowlist.
 */
export function applyCorsHeaders(headers: Headers, requestOrigin: string | null | undefined): void {
  const allowed = getAllowedOrigin(requestOrigin);
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400');
    // Vary so CDN caches per-origin
    headers.set('Vary', 'Origin');
  }
}

/**
 * Returns the appropriate Cache-Control value for an R2 asset path.
 *
 * Rules (#235):
 * - JS/CSS with a content hash in the filename: immutable, 1 year
 * - Images (png, jpg, jpeg, webp, svg, ico): 30 days + stale-while-revalidate
 * - HTML: no-cache (must revalidate)
 * - Fonts (woff2, woff, ttf, otf): immutable, 1 year
 * - Default: 1 hour
 */
export function getCacheControl(path: string): string {
  const lower = path.toLowerCase();

  // Strip query string for extension detection
  const pathname = lower.split('?')[0];

  // JS/CSS with hash — match patterns like app.a1b2c3.js or chunk-abc123.css
  // A hash segment is 5+ hex/alphanumeric characters between dots
  const hashedAssetRe = /\.[a-z0-9]{5,}\.(js|css)$/;
  if (hashedAssetRe.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }

  // Fonts
  if (/\.(woff2|woff|ttf|otf)$/.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }

  // Images
  if (/\.(png|jpe?g|webp|svg|ico|gif|avif)$/.test(pathname)) {
    return 'public, max-age=2592000, stale-while-revalidate=3600';
  }

  // HTML
  if (/\.html?$/.test(pathname)) {
    return 'public, max-age=0, must-revalidate';
  }

  // Default
  return 'public, max-age=3600';
}

/**
 * Builds a 204 No Content response for CORS OPTIONS preflight requests.
 */
export function handleCorsPreflight(requestOrigin: string | null | undefined): Response {
  const headers = new Headers();
  applyCorsHeaders(headers, requestOrigin);
  headers.set('Content-Length', '0');
  return new Response(null, { status: 204, headers });
}
