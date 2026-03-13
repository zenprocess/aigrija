/**
 * QR Code Check endpoint — POST /api/check-qr
 *
 * NOTE: QR image decoding happens client-side (e.g. jsQR in the browser).
 * This endpoint only receives the already-decoded URL string from the QR code.
 * It then runs the same URL analysis pipeline as /api/check.
 */

import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { analyzeUrl } from '../lib/url-analyzer';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { getFlag } from '../lib/feature-flags';
import { CheckQrRequestSchema, formatZodError } from '../lib/schemas';

const checkQr = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

checkQr.post('/api/check-qr', async (c) => {
  const rid = c.get('requestId');

  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['check-qr'].limit, ROUTE_RATE_LIMITS['check-qr'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  const { allowed, remaining, limit } = rl;

  if (!allowed) {
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

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
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

  const parsed = CheckQrRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: formatZodError(parsed.error),
          request_id: rid,
        },
      },
      400,
    );
  }

  const rawData = parsed.data.qr_data; // already trimmed by schema transform

  if (!isValidUrl(rawData)) {
    return c.json(
      {
        error: { code: 'INVALID_QR', message: 'Codul QR nu contine un URL valid.' },
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
