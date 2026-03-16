import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { CheckRequestSchema, MAX_TEXT_LENGTH, MAX_URL_LENGTH, formatZodError } from '../lib/schemas';
import { createRateLimiter, applyRateLimitHeaders, getRouteRateLimit } from '../lib/rate-limiter';
import { createClassifier } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { matchCampaigns } from '../lib/campaign-matcher';
import { BANK_PLAYBOOKS } from '../data/bank-playbooks';
import { getFlag } from '../lib/feature-flags';
import { matchScamPattern } from '../data/scam-patterns';
import { isGibberish } from '../lib/gibberish-detector';
import type { ScamPatternMatch } from '../data/scam-patterns';
import { storeReportSignal } from '../lib/campaign-aggregator';
import { storeCommunityReport } from './community';
import { prependFeedEntry } from './feed';
import type { ReportSignal } from '../lib/types';


const ClassificationSchema = z.object({
  verdict: z.enum(['phishing', 'suspicious', 'likely_safe']),
  confidence: z.number().min(0).max(1),
  scam_type: z.string(),
  impersonated_entity: z.string().optional(),
  red_flags: z.array(z.string()),
  explanation: z.string(),
  recommended_actions: z.array(z.string()),
  model_used: z.string().describe('Modelul AI folosit pentru analiza'),
  ai_disclaimer: z.string().describe('Disclaimer analiza AI'),
});

const UrlAnalysisSchema = z.object({
  url: z.string(),
  domain: z.string().optional(),
  is_suspicious: z.boolean(),
  risk_score: z.number(),
  flags: z.array(z.string()),
  safe_browsing_match: z.boolean().describe('URL gasit in Google Safe Browsing'),
  safe_browsing_threats: z.array(z.string()).describe('Tipuri de amenintari detectate de Safe Browsing'),
  domain_age_days: z.number().nullable().optional().describe('Varsta domeniului in zile'),
  registrar: z.string().nullable().optional().describe('Registratorul domeniului'),
  creation_date: z.string().nullable().optional().describe('Data inregistrarii domeniului'),
  is_new_domain: z.boolean().optional().describe('Domeniu inregistrat in ultimele 30 de zile'),
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

const ScamPatternSchema = z.object({
  name: z.string(),
  category: z.enum(['courier', 'tax', 'marketplace', 'bank', 'utility']),
  description: z.string(),
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
  share_id: z.string().optional().describe('ID-ul cardului de distribuire generat'),
  share_url: z.string().optional().describe('URL-ul cardului de distribuire pentru retele sociale'),
  matched_scam_pattern: ScamPatternSchema.optional().describe('Tiparul de scam romanesc detectat'),
});


function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

function buildShareSvg(verdict: string, confidence: number, scam_type: string): string {
  const styles: Record<string, { color: string; label: string; icon: string; bgAccent: string }> = {
    phishing: { color: '#ef4444', label: 'FRAUDĂ CONFIRMATĂ', icon: '⚠', bgAccent: '#7f1d1d' },
    suspicious: { color: '#f59e0b', label: 'SUSPECT', icon: '⚡', bgAccent: '#78350f' },
    likely_safe: { color: '#22c55e', label: 'PROBABIL SIGUR', icon: '✓', bgAccent: '#14532d' },
  };
  const style = styles[verdict] || styles['suspicious'];
  const pct = Math.round(Math.min(100, Math.max(0, confidence * 100)));
  const barWidth = Math.round((pct / 100) * 720);
  const safeType = escapeXml(scam_type.length > 28 ? scam_type.slice(0, 28) + '...' : scam_type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="8" height="630" fill="${style.color}"/>
  <rect x="0" y="0" width="1200" height="4" fill="${style.color}" opacity="0.6"/>
  <text x="60" y="72" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="2">AI-GRIJA.RO</text>
  <text x="60" y="96" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#475569">Protecție împotriva fraudelor online</text>
  <line x1="60" y1="116" x2="1140" y2="116" stroke="#334155" stroke-width="1"/>
  <circle cx="120" cy="240" r="60" fill="${style.bgAccent}" opacity="0.6"/>
  <text x="120" y="258" font-family="system-ui,-apple-system,sans-serif" font-size="48" fill="${style.color}" text-anchor="middle">${style.icon}</text>
  <text x="210" y="210" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="500" fill="${style.color}" letter-spacing="3">${style.label}</text>
  <text x="210" y="265" font-family="system-ui,-apple-system,sans-serif" font-size="52" font-weight="700" fill="#f1f5f9">${safeType}</text>
  <text x="60" y="350" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#64748b" letter-spacing="1">NIVEL DE ÎNCREDERE</text>
  <rect x="60" y="365" width="720" height="12" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <rect x="60" y="365" width="${barWidth}" height="12" rx="6" fill="${style.color}" opacity="0.85"/>
  <text x="796" y="377" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="${style.color}">${pct}%</text>
  <rect x="0" y="590" width="1200" height="40" fill="#0f172a" opacity="0.8"/>
  <text x="60" y="614" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#475569">Generat automat de AI-GRIJA.RO</text>
  <text x="900" y="614" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#475569" text-anchor="end">Proiect civic de Zen Labs</text>
</svg>`;
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.slice(0, 100));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

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

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const rid = c.get('requestId');

    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const rlCfg = getRouteRateLimit('check', c.env);
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

    const parsed = CheckRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: formatZodError(parsed.error), request_id: rid } }, 400);
    }
    const body = parsed.data;

    // Honeypot: bots fill hidden fields, real users do not
    if (body.website) {
      return c.json({
        request_id: rid,
        classification: {
          verdict: 'likely_safe',
          confidence: 0.95,
          scam_type: 'Necunoscut',
          red_flags: [],
          explanation: 'Mesajul pare legitim.',
          recommended_actions: [],
          model_used: 'none',
          ai_disclaimer: 'Analiza generata de AI.',
        },
        matched_campaigns: [],
        rate_limit: { remaining, limit },
      });
    }

    // Gibberish detection — reject garbage before calling AI
    const gibberishCheck = isGibberish(body.text);
    if (gibberishCheck.gibberish) {
      return c.json(
        { error: { code: 'GIBBERISH_INPUT', message: 'Textul introdus nu pare a fi un mesaj valid.', request_id: rid } },
        400
      );
    }

    // Load feature flags
    const [gemmaFallbackEnabled, phishtankEnabled, safeBrowsingEnabled] = await Promise.all([
      getFlag(c.env, 'gemma_fallback_enabled', true),
      getFlag(c.env, 'phishtank_enabled', true),
      getFlag(c.env, 'safe_browsing_enabled', true),
    ]);

    const classification = await createClassifier(c.env.AI)(body.text, body.url, { gemma_fallback_enabled: gemmaFallbackEnabled });
    const urlAnalysis = body.url
      ? await analyzeUrl(
          body.url,
          safeBrowsingEnabled ? c.env.GOOGLE_SAFE_BROWSING_KEY : undefined,
          c.env.VIRUSTOTAL_API_KEY,
          c.env.CACHE,
          c.env.URLHAUS_AUTH_KEY,
          phishtankEnabled ? c.env.PHISHTANK_API_KEY : undefined
        )
      : undefined;
    const campaignMatches = matchCampaigns(body.text, body.url);

    let bank_playbook = undefined;
    if (classification.impersonated_entity) {
      bank_playbook = BANK_PLAYBOOKS[classification.impersonated_entity];
    }
    if (!bank_playbook && campaignMatches.length > 0) {
      bank_playbook = BANK_PLAYBOOKS[campaignMatches[0].campaign.impersonated_entity];
    }

    const matchedScamPattern = matchScamPattern(body.text, body.url) || undefined;

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
      matched_scam_pattern: matchedScamPattern,
    };

    const countKey = 'stats:total_checks';
    const current = parseInt(await c.env.CACHE.get(countKey) || '0', 10);
    await c.env.CACHE.put(countKey, String(current + 1));

    // Store report signal for phishing/suspicious results only
    if (classification.verdict === 'phishing' || classification.verdict === 'suspicious') {
      const textHash = await hashText(body.text);
      const signal: ReportSignal = {
        verdict: classification.verdict,
        scam_type: classification.scam_type,
        url_domain: extractDomain(body.url),
        confidence: classification.confidence,
        timestamp: Date.now(),
      };
      c.executionCtx.waitUntil(storeReportSignal(c.env.CACHE, signal, textHash));
      const ipHash = await hashText(ip);
      c.executionCtx.waitUntil(
        storeCommunityReport(c.env.CACHE, rid, {
          url: body.url,
          text: body.text,
          verdict: classification.verdict,
          reporter_ip_hash: ipHash,
        })
      );
    }

    // Generate share card and store in R2
    const shareId = crypto.randomUUID();
    const svgContent = buildShareSvg(
      classification.verdict,
      classification.confidence,
      classification.scam_type
    );
    // Compute a stable hash for the /card/:hash route
    const cardHash = await hashText(body.text + (body.url ?? ''));
    const cardMeta = JSON.stringify({ verdict: classification.verdict, scam_type: classification.scam_type });
    c.executionCtx.waitUntil(
      Promise.all([
        c.env.STORAGE.put('share/' + shareId + '.svg', svgContent, {
          httpMetadata: { contentType: 'image/svg+xml' },
        }),
        c.env.STORAGE.put('cards/' + cardHash + '.svg', svgContent, {
          httpMetadata: { contentType: 'image/svg+xml' },
        }),
        c.env.CACHE.put('cards:meta:' + cardHash, cardMeta, { expirationTtl: 86400 }),
      ])
    );

    c.executionCtx.waitUntil(
      prependFeedEntry(c.env.CACHE, {
        verdict: classification.verdict,
        scam_type: classification.scam_type,
        timestamp: Date.now(),
      })
    );

    const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
    const shareUrl = `${baseUrl}/card/${cardHash}`;
    return c.json({ ...response, share_id: cardHash, share_url: shareUrl });
  }
}
