import type { Env, Campaign } from './types';
import { structuredLog } from './logger';

const DRAFT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const BASE_SYSTEM = `Ești un expert în securitate cibernetică care scrie articole de informare publică în limba română. Scrii pentru cetățeni non-tehnici. Tonul: calm, clar, fără jargon. Structura: titlu atractiv, rezumat 2 fraze, ce s-a întâmplat, cum te protejezi (3-5 pași), ce să faci dacă ești afectat. Returnează Markdown valid. 400-600 cuvinte.`;

const ALERT_SYSTEM = `Ești un expert în securitate cibernetică care scrie alerte de securitate în limba română pentru cetățeni non-tehnici. Scrie un articol de tip alertă urgentă: titlu direct cu cuvântul ALERTĂ, descriere scurtă a amenințării, cine este afectat, ce să faci ACUM (3-5 pași urgenti), unde să raportezi. Ton: serios dar nu alarmist. Returnează Markdown valid. 300-500 cuvinte.`;

const GUIDE_SYSTEM = `Ești un expert în securitate cibernetică care scrie ghiduri de protecție în limba română pentru cetățeni non-tehnici. Scrie un ghid practic de protecție: titlu cu Ghid de protecție, ce tip de atac este explicat simplu, cum funcționează atacul (pas cu pas), cum te protejezi preventiv (5-7 pași), ce să verifici dacă crezi că ai fost afectat. Ton: educativ, calm, practic. Returnează Markdown valid. 500-700 cuvinte.`;

const EDUCATION_SYSTEM = `Ești un expert în securitate cibernetică care scrie articole educaționale în limba română pentru cetățeni non-tehnici. Scrie un articol educațional: titlu informativ, ce este acest tip de amenințare (explicat ca pentru un copil de 12 ani), exemple reale din România, statistici dacă sunt disponibile, cum să recunoști atacul, resurse utile (DNSC, Politia Romana). Ton: educativ, calm, fără jargon tehnic. Returnează Markdown valid. 500-700 cuvinte.`;

function buildUserMessage(campaign: Campaign): string {
  const brands = campaign.affected_brands || 'Nespecificat';
  const body = (campaign.body_text || '').slice(0, 2000);
  return `Titlu campanie: ${campaign.title}
Data: ${campaign.created_at || new Date().toISOString().split('T')[0]}
Tip amenințare: ${campaign.threat_type || 'necunoscut'}
Entități afectate: ${brands}
Detalii: ${body}
Sursă: ${campaign.source_url || campaign.source || 'Necunoscută'}`;
}

export async function generateDraft(campaignId: string, env: Env): Promise<void> {
  const campaign = await fetchCampaign(campaignId, env);
  if (!campaign) {
    structuredLog('error', '[draft-generator] Campaign not found', { campaignId });
    return;
  }

  const messages = [
    { role: 'system', content: BASE_SYSTEM },
    { role: 'user', content: buildUserMessage(campaign) },
  ];

  try {
    const result = await (env.AI.run as Function)(DRAFT_MODEL, { messages, max_tokens: 1500 }) as { response?: string };
    const content = result?.response || '';

    await env.DB.prepare(
      `UPDATE campaigns SET draft_content = ?, draft_status = 'generated', updated_at = ? WHERE id = ?`
    ).bind(content, new Date().toISOString(), campaignId).run();

    structuredLog('info', '[draft-generator] Draft generated', { campaignId, contentLength: content.length });
  } catch (err) {
    structuredLog('error', '[draft-generator] Failed to generate draft', { campaignId, error: String(err) });
    throw err;
  }
}

export async function generateMultipleDrafts(campaignId: string, env: Env): Promise<void> {
  const campaign = await fetchCampaign(campaignId, env);
  if (!campaign) {
    structuredLog('error', '[draft-generator] Campaign not found for multi-draft', { campaignId });
    return;
  }

  const userMessage = buildUserMessage(campaign);
  const variants = [
    { type: 'alert', system: ALERT_SYSTEM, slug: '/amenintari' },
    { type: 'guide', system: GUIDE_SYSTEM, slug: '/ghid' },
    { type: 'education', system: EDUCATION_SYSTEM, slug: '/educatie' },
  ];

  const drafts: { type: string; slug: string; content: string }[] = [];

  for (const variant of variants) {
    const messages = [
      { role: 'system', content: variant.system },
      { role: 'user', content: userMessage },
    ];
    try {
      const result = await (env.AI.run as Function)(DRAFT_MODEL, { messages, max_tokens: 1500 }) as { response?: string };
      drafts.push({ type: variant.type, slug: variant.slug, content: result?.response || '' });
      structuredLog('info', '[draft-generator] Variant generated', { campaignId, type: variant.type });
    } catch (err) {
      structuredLog('error', '[draft-generator] Variant failed', { campaignId, type: variant.type, error: String(err) });
    }
  }

  const draftsJson = JSON.stringify(drafts);
  await env.DB.prepare(
    `UPDATE campaigns SET draft_content = ?, draft_status = 'generated', updated_at = ? WHERE id = ?`
  ).bind(draftsJson, new Date().toISOString(), campaignId).run();

  structuredLog('info', '[draft-generator] Multi-draft generated', { campaignId, variants: drafts.length });
}

async function fetchCampaign(campaignId: string, env: Env): Promise<Campaign | null> {
  const row = await env.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`).bind(campaignId).first<Campaign>();
  return row || null;
}

export { buildUserMessage, fetchCampaign };
