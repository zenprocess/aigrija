import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit } from '../lib/rate-limiter';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { matchCampaigns } from '../lib/campaign-matcher';
import { BANK_PLAYBOOKS } from '../data/bank-playbooks';

const MAX_TEXT_LENGTH = 5000;
const MAX_URL_LENGTH = 2048;

const CheckRequestSchema = z.object({
  text: z.string().min(3).max(MAX_TEXT_LENGTH).describe('Textul mesajului suspect'),
  url: z.string().max(MAX_URL_LENGTH).optional().describe('URL-ul suspect (optional)'),
});

const ClassificationSchema = z.object({
  verdict: z.enum(['phishing', 'suspicious', 'likely_safe']),
  confidence: z.number().min(0).max(1),
  scam_type: z.string(),
  impersonated_entity: z.string().optional(),
  red_flags: z.array(z.string()),
  explanation: z.string(),
  recommended_actions: z.array(z.string()),
});

const UrlAnalysisSchema = z.object({
  url: z.string(),
  domain: z.string().optional(),
  is_suspicious: z.boolean(),
  risk_score: z.number(),
  flags: z.array(z.string()),
});

const MatchedCampaignSchema = z.object({
  campaign_id: z.string(),
  campaign_name: z.string(),
  slug: z.string(),
  score: z.number(),
});

const BankPlaybookSchema = z.object({
  entity: z.string(),
  official_domain: z.string(),
  fraud_phone: z.string(),
  fraud_page: z.string(),
  if_compromised: z.array(z.string()),
});

const CheckResponseSchema = z.object({
  request_id: z.string(),
  classification: ClassificationSchema,
  url_analysis: UrlAnalysisSchema.optional(),
  matched_campaigns: z.array(MatchedCampaignSchema),
  bank_playbook: BankPlaybookSchema.optional(),
  rate_limit: z.object({
    remaining: z.number(),
    limit: z.number(),
  }),
});

export class CheckEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Analysis'],
    summary: 'Verifica un mesaj sau URL suspect',
    description: 'Analizeaza textul folosind AI pentru a detecta phishing, fraude si mesaje suspecte.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CheckRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Rezultatul analizei',
        content: {
          'application/json': {
            schema: CheckResponseSchema,
          },
        },
      },
      '400': {
        description: 'Date invalide',
      },
      '429': {
        description: 'Limita de cereri depasita',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const rid = c.get('requestId' as never) as string;

    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const { allowed, remaining, limit } = await checkRateLimit(c.env.CACHE, ip);

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      c.header('Retry-After', '3600');
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
    }

    let body: { text: string; url?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Request body invalid. Trimiteti JSON valid.', request_id: rid } }, 400);
    }

    if (!body.text || body.text.trim().length < 3) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Textul este prea scurt pentru analiza.', request_id: rid } }, 400);
    }

    if (body.text.length > MAX_TEXT_LENGTH) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `Textul depaseste limita de ${MAX_TEXT_LENGTH} caractere.`, request_id: rid } }, 400);
    }

    if (body.url && body.url.length > MAX_URL_LENGTH) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `URL-ul depaseste limita de ${MAX_URL_LENGTH} caractere.`, request_id: rid } }, 400);
    }

    const classification = await classify(c.env.AI, body.text, body.url);
    const urlAnalysis = body.url ? analyzeUrl(body.url) : undefined;
    const campaignMatches = matchCampaigns(body.text, body.url);

    let bank_playbook = undefined;
    if (classification.impersonated_entity) {
      bank_playbook = BANK_PLAYBOOKS[classification.impersonated_entity];
    }
    if (!bank_playbook && campaignMatches.length > 0) {
      bank_playbook = BANK_PLAYBOOKS[campaignMatches[0].campaign.impersonated_entity];
    }

    const response = {
      request_id: rid,
      classification,
      url_analysis: urlAnalysis,
      matched_campaigns: campaignMatches.map(m => ({
        campaign_id: m.campaign.id,
        campaign_name: m.campaign.name_ro,
        slug: m.campaign.slug,
        score: m.score,
      })),
      bank_playbook: bank_playbook ? {
        entity: classification.impersonated_entity || campaignMatches[0]?.campaign.impersonated_entity || '',
        official_domain: bank_playbook.official_domain,
        fraud_phone: bank_playbook.fraud_phone,
        fraud_page: bank_playbook.fraud_page,
        if_compromised: bank_playbook.if_compromised,
      } : undefined,
      rate_limit: { remaining, limit },
    };

    const countKey = 'stats:total_checks';
    const current = parseInt(await c.env.CACHE.get(countKey) || '0');
    await c.env.CACHE.put(countKey, String(current + 1));

    return c.json(response);
  }
}
