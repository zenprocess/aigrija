import { structuredLog } from '../lib/logger';
import { redactPii } from './pii-redactor';
export { matchScamPattern } from '../data/scam-patterns';
import type { ClassificationResult } from './types';

const PRIMARY_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const FALLBACK_MODEL = '@cf/google/gemma-3-12b-it';

const AI_DISCLAIMER = 'Analiza generata de AI. Rezultatele sunt orientative si nu constituie consiliere juridica.';

const SYSTEM_PROMPT = `Esti un expert roman in securitate cibernetica, specializat in fraudele din Romania.
Analizezi mesaje, SMS-uri, emailuri si URL-uri suspecte.

Contextul tau include campaniile de phishing active in Romania:
- Apeluri false "de la ING/BCR/BRD" care cer acces HomeBank
- SMS-uri FANBOX/FAN Courier cu link-uri de phishing
- Emailuri false ANAF cu "amenzi neplatite"
- Mesaje false de la Politia Romana/DNSC
- Rovinieta/taxe auto false
- Deepfake-uri cu personalitati publice

Indicatori de frauda:
- Ton de urgenta ("contul dvs va fi blocat", "aveti 24h")
- Solicitare date personale/bancare
- Domenii look-alike (ing-romania.com != ing.ro)
- Link-uri scurte sau obfuscate
- Greseli gramaticale tipice
- Numere de telefon neoficiale

Raspunde STRICT in JSON conform schemei furnizate.

IMPORTANT: Foloseste romana simpla (nivel A2-B1). Propozitii scurte (maxim 15 cuvinte).
Explica termenii tehnici in paranteze. Exemplu: "inselaciune online (phishing)".
Evita cuvinte straine fara explicatii. Foloseste limbaj de zi cu zi, pe intelesul unui om de 65 de ani.
Vorbeste la forma activa. Fii direct si clar.`;

async function runModel(ai: Ai, model: string, messages: { role: string; content: string }[]): Promise<{ response?: string }> {
  return (ai.run as (model: string, input: { messages: { role: string; content: string }[] }) => Promise<{ response?: string }>)(model, { messages });
}

function parseAiResponse(raw: string | undefined): Omit<ClassificationResult, 'model_used' | 'ai_disclaimer'> | null {
  if (!raw || raw.trim() === '') return null;
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr);
    if (!parsed.verdict) return null;
    return {
      verdict: parsed.verdict || 'suspicious',
      confidence: parsed.confidence || 0.5,
      scam_type: parsed.scam_type || 'necunoscut',
      impersonated_entity: parsed.impersonated_entity,
      red_flags: parsed.red_flags || [],
      explanation: parsed.explanation || 'Nu s-a putut genera o explicatie.',
      recommended_actions: parsed.recommended_actions || [],
    };
  } catch {
    return null;
  }
}

export interface ClassifierFlags {
  gemma_fallback_enabled?: boolean;
}

export class ClassificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassificationValidationError';
  }
}

const MIN_TEXT_LENGTH = 3;
const MAX_TEXT_LENGTH = 5000;

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function validateAndSanitizeInput(text: string): string {
  const stripped = stripHtml(text);
  const trimmed = stripped.trim();

  if (trimmed.length === 0) {
    throw new ClassificationValidationError('Textul nu poate fi gol sau compus doar din spatii.');
  }
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ClassificationValidationError(`Textul este prea scurt pentru analiza (minim ${MIN_TEXT_LENGTH} caractere).`);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new ClassificationValidationError(`Textul depaseste limita de ${MAX_TEXT_LENGTH} caractere.`);
  }

  return trimmed;
}

export async function classify(
  ai: Ai,
  text: string,
  url?: string,
  flags: ClassifierFlags = {}
): Promise<ClassificationResult> {
  const { gemma_fallback_enabled = true } = flags;

  const sanitizedText = validateAndSanitizeInput(text);
  const { redacted: piiSafeText, count: piiCount } = redactPii(sanitizedText);
  if (piiCount > 0) {
    structuredLog('info', '[classifier] PII redacted before AI call', { count: piiCount });
  }

  const userMessage = url
    ? `Analizeaza acest mesaj si URL-ul asociat:\n\nMesaj: ${piiSafeText}\nURL: ${url}`
    : `Analizeaza acest mesaj:\n\n${piiSafeText}`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  let modelUsed = PRIMARY_MODEL;
  let parsed: Omit<ClassificationResult, 'model_used' | 'ai_disclaimer'> | null = null;

  try {
    const response = await runModel(ai, PRIMARY_MODEL, messages);
    parsed = parseAiResponse(response.response);
    if (parsed) {
      structuredLog('debug', '[classifier] Primary model used', { model: PRIMARY_MODEL });
    } else {
      structuredLog('warn', '[classifier] Primary model returned empty/invalid response', { fallback: FALLBACK_MODEL });
    }
  } catch (err) {
    structuredLog('warn', '[classifier] Primary model threw error', { fallback: FALLBACK_MODEL, error: String(err) });
  }

  if (!parsed && gemma_fallback_enabled) {
    modelUsed = FALLBACK_MODEL;
    try {
      const response = await runModel(ai, FALLBACK_MODEL, messages);
      parsed = parseAiResponse(response.response);
      if (parsed) {
        structuredLog('debug', '[classifier] Fallback model used', { model: FALLBACK_MODEL });
      }
    } catch (err) {
      structuredLog('error', '[classifier] Fallback model also failed', { error: String(err) });
    }
  } else if (!parsed && !gemma_fallback_enabled) {
    structuredLog('warn', '[classifier] Gemma fallback disabled by feature flag — skipping fallback');
  }

  if (parsed) {
    return {
      ...parsed,
      model_used: modelUsed,
      ai_disclaimer: AI_DISCLAIMER,
    };
  }

  return {
    verdict: 'suspicious',
    confidence: 0.3,
    scam_type: 'necunoscut',
    red_flags: ['Analiza automata nu a putut fi finalizata'],
    explanation: 'Mesajul a fost primit dar analiza automata nu a putut fi finalizata. Va recomandam prudenta.',
    recommended_actions: ['Tratati mesajul cu precautie', 'Raportati la DNSC (1911)'],
    model_used: modelUsed,
    ai_disclaimer: AI_DISCLAIMER,
  };
}
