import type { Env, Campaign } from './types';
import { structuredLog } from './logger';

const DRAFT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ── Input sanitization ────────────────────────────────────────────────────────

/** Control characters: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F. Tab/LF/CR are kept. */
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Prompt-injection sequences that attempt role-switching or instruction override. */
const INJECTION_RE = [
  /\n[ \t]*(system|human|assistant|user|ai)\s*:/gi,
  /<\|im_(start|end)\|>/gi,
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(everything|all)\s+(above|previous)/gi,
  /new\s+(system\s+)?instructions?\s*:/gi,
];

const MAX_BODY_LENGTH = 2000;

/**
 * Sanitize a string before embedding it in an AI prompt.
 * 1. Strips control characters (keeps \\t, \\n, \\r).
 * 2. Neutralizes prompt-injection sequences.
 * 3. Truncates to maxLength.
 */
export function sanitizePromptInput(input: string, maxLength: number = 500): string {
  let s = input.replace(CONTROL_CHAR_RE, '');
  for (const re of INJECTION_RE) {
    s = s.replace(re, '[redacted]');
  }
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

// GEPA-optimized prompts: structured output schema, evaluation criteria, few-shot examples

const BASE_SYSTEM = `Ești un expert în securitate cibernetică care scrie articole de informare publică în limba română.
Publicul tău: cetățeni non-tehnici, inclusiv persoane de 60+ ani.

## Criterii de calitate (GEPA)
- Lizibilitate română: propoziții de maxim 20 de cuvinte, vocabular simplu (nivel B1)
- Acuratețe: nu inventa statistici; dacă nu știi, spune "conform tendințelor recente"
- SEO: titlul trebuie să aibă 50-65 caractere; include cuvinte-cheie relevante

## Structură obligatorie
1. Titlu atractiv (50-65 caractere, cuvânt-cheie inclus)
2. Rezumat: 2 propoziții scurte
3. Ce s-a întâmplat (context simplu)
4. Cum te protejezi: 3-5 pași numerotați
5. Ce să faci dacă ești afectat
6. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu structură titlu bun
- "ALERTĂ: SMS-uri false de la FAN Courier fură datele românilor" (60 car.) ✓
- "Phishing" (8 car.) ✗ (prea scurt, fără context)

Returnează Markdown valid. 400-600 cuvinte total (fără meta descriere).`;

const ALERT_SYSTEM = `Ești un expert în securitate cibernetică care scrie alerte urgente în limba română.
Publicul tău: cetățeni non-tehnici, inclusiv persoane de 60+ ani.

## Criterii de calitate (GEPA)
- Lizibilitate română: propoziții de maxim 15 cuvinte, ton direct, fără jargon
- Acuratețe: descrie amenințarea corect; nu exagera gravitatea, nu minimiza
- SEO: titlul începe cu "ALERTĂ:", 50-65 caractere total

## Structură obligatorie
1. Titlu: începe cu "ALERTĂ:" + descriere scurtă (50-65 caractere)
2. Cine este afectat (1-2 propoziții)
3. Ce să faci ACUM: 3-5 pași numerotați, fiecare maxim 15 cuvinte
4. Unde să raportezi: DNSC (www.dnsc.ro, tel. 1911), Politia Română (112)
5. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu pas de acțiune bun
- "1. Nu accesa link-ul din mesaj. Șterge mesajul imediat." ✓
- "1. Utilizatorul trebuie să evite interacțiunea cu conținutul potențial malițios." ✗ (prea tehnic)

Ton: serios dar nu alarmist. Returnează Markdown valid. 300-500 cuvinte total.`;

const GUIDE_SYSTEM = `Ești un expert în securitate cibernetică care scrie ghiduri practice de protecție în limba română.
Publicul tău: cetățeni non-tehnici, inclusiv persoane de 60+ ani.

## Criterii de calitate (GEPA)
- Lizibilitate română: propoziții de maxim 20 de cuvinte, explică termenii tehnici în paranteză
- Acuratețe: pași de protecție verificabili, bazați pe practici reale recomandate de DNSC/ENISA
- SEO: titlul conține "Ghid de protecție" + subiect specific, 50-65 caractere

## Structură obligatorie
1. Titlu: "Ghid de protecție: [subiect]" (50-65 caractere)
2. Ce este acest tip de atac (explicat simplu, 2-3 propoziții)
3. Cum funcționează atacul: 3-4 pași simpli
4. Cum te protejezi preventiv: 5-7 pași numerotați
5. Ce să verifici dacă crezi că ai fost afectat: 3-4 pași
6. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu explicație bună a unui termen tehnic
- "phishing (înșelăciune online prin mesaje false)" ✓
- "phishing attack vector" ✗ (neadaptat)

Ton: educativ, calm, practic. Returnează Markdown valid. 500-700 cuvinte total.`;

const EDUCATION_SYSTEM = `Ești un expert în securitate cibernetică care scrie articole educaționale în limba română.
Publicul tău: cetățeni non-tehnici, inclusiv persoane de 60+ ani.

## Criterii de calitate (GEPA)
- Lizibilitate română: explică fiecare concept ca și cum vorbeai cu un copil de 12 ani; propoziții scurte
- Acuratețe: folosește exemple reale din România (DNSC, CERT-RO); nu inventa cazuri
- SEO: titlul informativ cu cuvinte-cheie, 50-65 caractere

## Structură obligatorie
1. Titlu informativ cu cuvinte-cheie (50-65 caractere)
2. Ce este această amenințare (analogie simplă din viața de zi cu zi)
3. Exemple reale din România (cu sursa dacă există: DNSC, Politia Română)
4. Cum recunoști atacul: 4-5 semne de alarmă
5. Resurse utile: DNSC (www.dnsc.ro, 1911), Politia Română, CERT-RO
6. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu analogie bună
- "Phishing-ul este ca o scrisoare falsă de la bancă, trimisă de un hoț care vrea parola ta." ✓
- "Phishing este o metodă de atac cibernetic sofisticată." ✗ (jargon, abstractă)

Ton: educativ, calm, fără jargon tehnic. Returnează Markdown valid. 500-700 cuvinte total.`;

const STORY_SYSTEM = `Ești un jurnalist de investigație specializat în securitate cibernetică în România.
Publicul tău: cititori generali interesați de cazuri reale de fraudă online.

## Criterii de calitate (GEPA)
- Lizibilitate română: narațiune fluidă, propoziții variate (10-25 cuvinte), dialog autentic
- Acuratețe: anonimizează victima (schimbă numele, orașul); nu inventa detalii tehnice false
- SEO: titlu emoțional cu situația reală, 50-65 caractere

## Structură obligatorie
1. Titlu emoțional (situația victimei, 50-65 caractere)
2. Situația inițială: cine este victima (anonimizată: "Maria, 58 ani, din Cluj")
3. Cum s-a produs atacul: cronologie clară
4. Ce a pierdut (financiar, emoțional, timp)
5. Cum s-a rezolvat sau de ce nu s-a rezolvat
6. Lecții învățate: 3 sfaturi concrete
7. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu început bun
- "Maria din Cluj a primit un SMS de la 'BRD'. În 10 minute, contul ei era golit." ✓
- "Un individ a perpetrat un atac de tip phishing asupra unui utilizator." ✗ (rece, jargon)

Ton: empatic, educativ, respectuos cu victima. Returnează Markdown valid. 500-700 cuvinte total.`;

const REPORT_SYSTEM = `Ești un analist de securitate cibernetică care scrie rapoarte sintetice în limba română.
Publicul tău: cetățeni, jurnaliști, reprezentanți ai instituțiilor.

## Criterii de calitate (GEPA)
- Lizibilitate română: limbaj profesional dar accesibil; evită acronime neexplicate
- Acuratețe: bazează-te pe tendințe reale; când estimezi, menționează explicit "estimat"
- SEO: titlul include perioada și tipul de raport, 50-65 caractere

## Structură obligatorie
1. Titlu: "Raport [săptămânal/lunar]: Amenințări cibernetice în România – [Perioadă]" (50-65 car.)
2. Rezumat executiv (3-4 propoziții cu concluziile principale)
3. Top 3 tipuri de atacuri: fiecare cu descriere scurtă și impact estimat
4. Statistici (marchează cu "(estimat)" ce nu e din surse oficiale verificabile)
5. Recomandări: 3-4 pentru cetățeni, 2-3 pentru organizații
6. Surse: DNSC (dnsc.ro), CERT-RO (cert.ro), Europol, Politia Română
7. Meta descriere SEO (150-160 caractere) la final, prefixată cu "META:"

## Exemplu statistică bine prezentată
- "Atacurile de phishing au crescut cu ~30% față de luna precedentă (estimat, conform tendințelor DNSC)." ✓
- "Phishing-ul a crescut cu 847%." ✗ (număr inventat, fără sursă)

Ton: profesional, bazat pe date, echilibrat. Returnează Markdown valid. 600-800 cuvinte total.`;

function buildUserMessage(campaign: Campaign): string {
  const title = sanitizePromptInput(campaign.title || '');
  const threatType = sanitizePromptInput(campaign.threat_type || 'necunoscut');
  const brands = sanitizePromptInput(campaign.affected_brands || 'Nespecificat');
  const body = sanitizePromptInput(campaign.body_text || '', MAX_BODY_LENGTH);
  const source = sanitizePromptInput(campaign.source_url || campaign.source || 'Necunoscută');
  return `Titlu campanie: ${title}
Data: ${campaign.created_at || new Date().toISOString().split('T')[0]}
Tip amenințare: ${threatType}
Entități afectate: ${brands}
Detalii: ${body}
Sursă: ${source}`;
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
    const result = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(DRAFT_MODEL, { messages, max_tokens: 1500 });
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
      const result = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(DRAFT_MODEL, { messages, max_tokens: 1500 });
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

export async function generateStandalonePost(env: Env): Promise<void> {
  const dayOfWeek = new Date().getUTCDay(); // 1=Mon, 5=Fri
  if (dayOfWeek < 1 || dayOfWeek > 5) return; // skip weekends

  const categories = ["amenintari", "ghid", "educatie", "povesti", "rapoarte"];
  const category = categories[dayOfWeek - 1];

  const systemPromptMap: Record<string, string> = {
    amenintari: ALERT_SYSTEM,
    ghid: GUIDE_SYSTEM,
    educatie: EDUCATION_SYSTEM,
    povesti: STORY_SYSTEM,
    rapoarte: REPORT_SYSTEM,
  };

  const systemPrompt = systemPromptMap[category];

  // Step 1: generate a specific topic title via meta-prompt
  let topic = '';
  try {
    const topicResult = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(
      DRAFT_MODEL,
      {
        messages: [
          { role: "system", content: "You are a cybersecurity editor. Respond ONLY with a short article title in Romanian, no explanation, no punctuation beyond the title itself." },
          { role: "user", content: `Sugerează un subiect specific de securitate cibernetică în România pentru o categorie "${category}". Returnează DOAR titlul subiectului, fără explicații.` },
        ],
        max_tokens: 60,
      }
    );
    topic = (topicResult?.response || '').trim().replace(/^["']+|["']+$/g, '').trim();
  } catch (err) {
    structuredLog('error', '[draft-generator] Failed to generate topic', { category, error: String(err) });
    throw err;
  }

  if (!topic) {
    structuredLog('error', '[draft-generator] Empty topic returned', { category });
    return;
  }

  // Step 2: generate the full article
  let articleContent = '';
  try {
    const articleResult = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(
      DRAFT_MODEL,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Scrie un articol complet despre: ${topic}` },
        ],
        max_tokens: 1500,
      }
    );
    articleContent = articleResult?.response || '';
  } catch (err) {
    structuredLog('error', '[draft-generator] Failed to generate article', { category, topic, error: String(err) });
    throw err;
  }

  // Step 3: insert into D1 as admin draft
  const id = crypto.randomUUID();
  const slug = topic.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') + '-' + id.slice(0, 8);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO campaigns (id, slug, title, source, draft_status, draft_content, severity, threat_type, created_at, updated_at)
       VALUES (?, ?, ?, 'ai-generated', 'generated', ?, 'medium', ?, ?, ?)`
    ).bind(id, slug, topic, articleContent, category, now, now).run();
    structuredLog('info', '[draft-generator] Standalone post inserted', { id, category, topic, contentLength: articleContent.length });
  } catch (err) {
    structuredLog('error', '[draft-generator] Failed to insert standalone post', { id, category, topic, error: String(err) });
    throw err;
  }
}


export interface GenerateOptions {
  category?: string;
  topic?: string;
}

export async function generateStandalonePostWithOverrides(env: Env, options: GenerateOptions = {}): Promise<{ id: string; title: string }> {
  const systemPromptMap: Record<string, string> = {
    amenintari: ALERT_SYSTEM,
    ghid: GUIDE_SYSTEM,
    educatie: EDUCATION_SYSTEM,
    povesti: STORY_SYSTEM,
    rapoarte: REPORT_SYSTEM,
  };

  let category = options.category;
  if (!category) {
    const dayOfWeek = new Date().getUTCDay();
    const categories = ["amenintari", "ghid", "educatie", "povesti", "rapoarte"];
    category = dayOfWeek >= 1 && dayOfWeek <= 5 ? categories[dayOfWeek - 1] : categories[0];
  }

  const systemPrompt = systemPromptMap[category] ?? ALERT_SYSTEM;

  let topic = options.topic?.trim() ?? "";

  // Step 1: generate topic via meta-prompt only if no topic override
  if (!topic) {
    try {
      const topicResult = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(
        DRAFT_MODEL,
        {
          messages: [
            { role: "system", content: "You are a cybersecurity editor. Respond ONLY with a short article title in Romanian, no explanation, no punctuation beyond the title itself." },
            { role: "user", content: `Sugereaza un subiect specific de securitate cibernetica in Romania pentru categoria "${category}". Returneaza DOAR titlul subiectului, fara explicatii.` },
          ],
          max_tokens: 60,
        }
      );
      topic = (topicResult?.response || "").trim().replace(/^["']+|["']+$/g, "").trim();
    } catch (err) {
      structuredLog("error", "[draft-generator] Failed to generate topic", { category, error: String(err) });
      throw err;
    }
  }

  if (!topic) {
    structuredLog("error", "[draft-generator] Empty topic returned", { category });
    throw new Error("Empty topic returned from AI");
  }

  // Step 2: generate the full article
  let articleContent = "";
  try {
    const articleResult = await (env.AI.run as (model: string, inputs: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<{ response?: string }>)(
      DRAFT_MODEL,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Scrie un articol complet despre: ${topic}` },
        ],
        max_tokens: 1500,
      }
    );
    articleContent = articleResult?.response || "";
  } catch (err) {
    structuredLog("error", "[draft-generator] Failed to generate article", { category, topic, error: String(err) });
    throw err;
  }

  // Step 3: insert into D1 as admin draft
  const id = crypto.randomUUID();
  const slug = topic.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') + '-' + id.slice(0, 8);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO campaigns (id, slug, title, source, draft_status, draft_content, severity, threat_type, created_at, updated_at)
       VALUES (?, ?, ?, 'ai-generated', 'generated', ?, 'medium', ?, ?, ?)`
    ).bind(id, slug, topic, articleContent, category, now, now).run();
    structuredLog("info", "[draft-generator] Standalone post inserted (with overrides)", { id, category, topic, contentLength: articleContent.length });
  } catch (err) {
    structuredLog("error", "[draft-generator] Failed to insert standalone post", { id, category, topic, error: String(err) });
    throw err;
  }

  return { id, title: topic };
}

export { buildUserMessage, fetchCampaign };

