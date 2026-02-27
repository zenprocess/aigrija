import { Hono } from 'hono';
import type { Env, CheckRequest, CheckResponse } from '../lib/types';
import { checkRateLimit } from '../lib/rate-limiter';
import { classify } from '../lib/classifier';
import { analyzeUrl } from '../lib/url-analyzer';
import { matchCampaigns } from '../lib/campaign-matcher';
import { BANK_PLAYBOOKS } from '../data/bank-playbooks';

const check = new Hono<{ Bindings: Env }>();

check.post('/api/check', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const { allowed, remaining } = await checkRateLimit(c.env.CACHE, ip);
  if (!allowed) {
    return c.json({ error: 'Limita de verificari depasita. Incercati din nou mai tarziu.' }, 429);
  }

  const body = await c.req.json<CheckRequest>();
  if (!body.text || body.text.trim().length < 3) {
    return c.json({ error: 'Textul este prea scurt pentru analiza.' }, 400);
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

  const response: CheckResponse = {
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
    rate_limit: { remaining },
  };

  // Increment counter
  const countKey = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(countKey) || '0');
  await c.env.CACHE.put(countKey, String(current + 1));

  return c.json(response);
});

export { check };
