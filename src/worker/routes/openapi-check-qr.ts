import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { analyzeUrl } from '../lib/url-analyzer';
import { createRateLimiter, applyRateLimitHeaders, getRouteRateLimit } from '../lib/rate-limiter';
import { getFlag } from '../lib/feature-flags';
import { CheckQrRequestSchema, formatZodError } from '../lib/schemas';

const UrlAnalysisSchema = z.object({
  url: z.string(),
  domain: z.string().optional(),
  is_suspicious: z.boolean(),
  risk_score: z.number(),
  flags: z.array(z.string()),
  safe_browsing_match: z.boolean(),
  safe_browsing_threats: z.array(z.string()),
  domain_age_days: z.number().nullable().optional(),
  registrar: z.string().nullable().optional(),
  creation_date: z.string().nullable().optional(),
  is_new_domain: z.boolean().optional(),
});

const CheckQrResponseSchema = z.object({
  request_id: z.string(),
  url_analysis: UrlAnalysisSchema,
  rate_limit: z.object({
    remaining: z.number(),
    limit: z.number(),
  }),
});

export class CheckQrEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Analysis'],
    summary: 'Analizeaza URL-ul dintr-un cod QR',
    description: 'Primeste URL-ul decodat dintr-un cod QR si ruleaza analiza de securitate (Safe Browsing, VirusTotal, URLhaus, analiza domeniu).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CheckQrRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Rezultatul analizei URL-ului din QR',
        content: {
          'application/json': {
            schema: CheckQrResponseSchema,
          },
        },
      },
      '400': {
        description: 'Date invalide',
      },
      '422': {
        description: 'Codul QR nu contine un URL valid',
      },
      '429': {
        description: 'Limita de cereri depasita',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const rid = c.get('requestId');

    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const rlCfg = getRouteRateLimit('check-qr', c.env);
    const rl = await createRateLimiter(c.env.CACHE)(ip, rlCfg.limit, rlCfg.windowSeconds);
    applyRateLimitHeaders((k, v) => c.header(k, v), rl);
    const { allowed, remaining, limit } = rl;

    if (!allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Request body invalid. Trimiteti JSON valid.', request_id: rid } }, 400);
    }

    const parsed = CheckQrRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: formatZodError(parsed.error), request_id: rid } }, 400);
    }

    const rawData = parsed.data.qr_data;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawData);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return c.json({
        error: { code: 'INVALID_QR', message: 'Codul QR nu contine un URL valid.' },
        is_url: false,
        raw_data: rawData,
        request_id: rid,
      }, 422);
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
  }
}
