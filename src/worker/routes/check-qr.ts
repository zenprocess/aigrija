/**
 * QR Code Check endpoint — POST /api/check-qr
 *
 * NOTE: QR image decoding happens client-side (e.g. jsQR in the browser).
 * This endpoint only receives the already-decoded URL string from the QR code.
 * It then runs the same URL analysis pipeline as /api/check.
 */

import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { analyzeUrl } from '../lib/url-analyzer';
import { checkRateLimit } from '../lib/rate-limiter';
import { getFlag } from '../lib/feature-flags';

const checkQr = new Hono<{ Bindings: Env }>();

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

checkQr.post('/api/check-qr', async (c) => {
  const rid = c.get('requestId' as never) as string;

  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const { allowed, remaining, limit } = await checkRateLimit(c.env.CACHE, ip);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    c.header('Retry-After', '3600');
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Limita de verificari depasita. Incercati din nou mai tarziu.',
          request_id: rid,
        },
      },
      429,
    );
  }

  let body: { qr_data: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body invalid. Trimiteti JSON valid.',
          request_id: rid,
        },
      },
      400,
    );
  }

  if (!body.qr_data || typeof body.qr_data !== 'string' || body.qr_data.trim().length === 0) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Campul qr_data este obligatoriu.',
          request_id: rid,
        },
      },
      400,
    );
  }

  const rawData = body.qr_data.trim();

  if (!isValidUrl(rawData)) {
    return c.json(
      {
        error: { code: 'INVALID_QR', message: 'QR code does not contain a URL' },
        is_url: false,
        raw_data: rawData,
        request_id: rid,
      },
      422,
    );
  }

  const safeBrowsingEnabled = await getFlag(c.env, 'safe_browsing_enabled', true);

  const urlAnalysis = await analyzeUrl(
    rawData,
    safeBrowsingEnabled ? c.env.GOOGLE_SAFE_BROWSING_KEY : undefined,
    c.env.VIRUSTOTAL_API_KEY,
    c.env.CACHE,
    c.env.URLHAUS_AUTH_KEY,
  );

  return c.json({
    request_id: rid,
    url_analysis: urlAnalysis,
    rate_limit: { remaining, limit },
  });
});

export { checkQr };
