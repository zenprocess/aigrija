import { Hono } from 'hono';
import type { Env, CheckRequest, CheckResponse, ReportSignal } from '../lib/types';
import { checkRateLimit } from '../lib/rate-limiter';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { matchCampaigns } from '../lib/campaign-matcher';
import { BANK_PLAYBOOKS } from '../data/bank-playbooks';
import { storeReportSignal } from '../lib/campaign-aggregator';


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

const MAX_TEXT_LENGTH = 5000;
const MAX_URL_LENGTH = 2048;

const check = new Hono<{ Bindings: Env }>();

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.slice(0, 100));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

check.post('/api/check', async (c) => {
  const rid = c.get('requestId' as never) as string;

  // #19: IP fallback chain
  const ip = c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';

  const { allowed, remaining, limit } = await checkRateLimit(c.env.CACHE, ip);

  // #17: Rate limit headers on all responses
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    c.header('Retry-After', '3600');
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
  }

  let body: CheckRequest;
  try {
    body = await c.req.json<CheckRequest>();
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
  const urlAnalysis = body.url ? await analyzeUrl(body.url, c.env.GOOGLE_SAFE_BROWSING_KEY) : undefined;
  const campaignMatches = matchCampaigns(body.text, body.url);

  let bank_playbook = undefined;
  if (classification.impersonated_entity) {
    bank_playbook = BANK_PLAYBOOKS[classification.impersonated_entity];
  }
  if (!bank_playbook && campaignMatches.length > 0) {
    bank_playbook = BANK_PLAYBOOKS[campaignMatches[0].campaign.impersonated_entity];
  }

  const response: CheckResponse = {
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

  // Increment counter
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
    // Fire-and-forget — don't block response
    c.executionCtx.waitUntil(storeReportSignal(c.env, signal, textHash));
  }

  // Generate share card and store in R2
  const shareId = crypto.randomUUID();
  const svgContent = buildShareSvg(
    classification.verdict,
    classification.confidence,
    classification.scam_type
  );
  c.executionCtx.waitUntil(
    c.env.STORAGE.put('share/' + shareId + '.svg', svgContent, {
      httpMetadata: { contentType: 'image/svg+xml' },
    })
  );

  const responseWithShare = { ...response, share_id: shareId };
  return c.json(responseWithShare);
});

export { check };
