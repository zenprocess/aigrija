import { structuredLog } from '../lib/logger';
import { redactPii } from './pii-redactor';
export { matchScamPattern } from '../data/scam-patterns';
import type { ClassificationResult } from './types';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

const PRIMARY_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const FALLBACK_MODEL = '@cf/google/gemma-3-12b-it';

const AI_DISCLAIMER = 'Analiza generata de AI. Rezultatele sunt orientative si nu constituie consiliere juridica.';

// GEPA-optimized classifier prompt: JSON schema, few-shot examples, evaluation criteria
const SYSTEM_PROMPT = `Esti un expert roman in securitate cibernetica, specializat in fraudele din Romania.
Analizezi mesaje, SMS-uri, emailuri si URL-uri suspecte trimise de cetateni romani.

## Criterii de calitate (GEPA)
- Lizibilitate: romana simpla (nivel A2-B1), propozitii de maxim 15 cuvinte
- Acuratete: bazeaza-te pe indicatori concreți din mesaj; nu ghici
- Claritate: explica termenii tehnici in paranteze; vorbeste la forma activa

## Campanii active de phishing in Romania (context)
- Apeluri false de la ING/BCR/BRD care cer acces HomeBank
- SMS-uri FANBOX/FAN Courier cu link-uri de phishing
- Emailuri false ANAF cu "amenzi neplatite"
- Mesaje false de la Politia Romana/DNSC
- Rovinieta si taxe auto false
- Deepfake-uri cu personalitati publice (investitii false)

## Indicatori de frauda
- Ton de urgenta ("contul dvs va fi blocat", "aveti 24h")
- Solicitare date personale sau bancare
- Domenii look-alike (ing-romania.com vs ing.ro)
- Link-uri scurte sau URL-uri obfuscate
- Greseli gramaticale tipice traducerilor automate
- Numere de telefon neoficiale sau internationale

## Schema JSON obligatorie
Raspunde EXCLUSIV cu JSON valid (fara text inainte sau dupa), conform acestei scheme:
{
  "verdict": "phishing" | "scam" | "suspicious" | "legitimate",
  "confidence": <numar intre 0.0 si 1.0>,
  "scam_type": "<tipul specific de frauda sau 'necunoscut'>",
  "impersonated_entity": "<entitatea falsificata sau null>",
  "red_flags": ["<indicator 1>", "<indicator 2>"],
  "explanation": "<explicatie in romana simpla, maxim 3 propozitii scurte>",
  "recommended_actions": ["<actiune 1>", "<actiune 2>", "<actiune 3>"]
}

## Exemple few-shot

Mesaj de analizat: "Contul tau BRD a fost blocat. Acceseaza urgent: brd-secure-login.xyz"
Raspuns corect:
{"verdict":"phishing","confidence":0.97,"scam_type":"phishing-bancar","impersonated_entity":"BRD","red_flags":["domeniu fals (brd-secure-login.xyz)","ton de urgenta","link suspect"],"explanation":"Acesta este un mesaj fals (phishing). BRD nu trimite niciodata link-uri externe. Nu accesa link-ul.","recommended_actions":["Nu accesa link-ul","Sterge mesajul imediat","Suna la BRD: 0800 801 100"]}

Mesaj de analizat: "Iti multumim pentru comanda #12345. Coletul va sosi marti."
Raspuns corect:
{"verdict":"legitimate","confidence":0.92,"scam_type":"necunoscut","impersonated_entity":null,"red_flags":[],"explanation":"Mesajul pare legitim. Nu contine indicatori de frauda.","recommended_actions":["Verifica comanda direct pe site-ul oficial"]}

## Reguli finale
- Explica termenii tehnici in paranteze: "phishing (inselaciune online)", "malware (virus informatic)"
- Nu inventa indicatori care nu sunt in mesaj
- Confidence sub 0.5 inseamna ca nu esti sigur — mentioneaza asta in explanation
- Vorbeste intotdeauna la forma activa, direct si clar`;

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
  let result = text;
  let prev: string;
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  return result;
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
  if (stripped.length > MAX_TEXT_LENGTH) {
    throw new ClassificationValidationError(`Textul depaseste limita de ${MAX_TEXT_LENGTH} caractere.`);
  }

  return trimmed;
}

/**
 * Factory function that binds an AI binding to the classifier.
 * Returns a function with the same signature as classify minus the first argument.
 *
 * @param ai  Cloudflare Workers AI binding.
 * @param kv  Optional KV namespace for circuit breaker state persistence.
 */
export function createClassifier(ai: Ai, kv?: KVNamespace) {
  return (
    text: string,
    url?: string,
    flags?: ClassifierFlags,
  ): Promise<ClassificationResult> => classify(ai, text, url, flags, kv);
}

export async function classify(
  ai: Ai,
  text: string,
  url?: string,
  flags: ClassifierFlags = {},
  kv?: KVNamespace,
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
    let response: { response?: string };
    if (kv) {
      const cb = new CircuitBreaker('ai-primary', kv, { failureThreshold: 3 });
      response = await cb.execute(() => runModel(ai, PRIMARY_MODEL, messages));
    } else {
      response = await runModel(ai, PRIMARY_MODEL, messages);
    }
    parsed = parseAiResponse(response.response);
    if (parsed) {
      structuredLog('debug', '[classifier] Primary model used', { model: PRIMARY_MODEL });
    } else {
      structuredLog('warn', '[classifier] Primary model returned empty/invalid response', { fallback: FALLBACK_MODEL });
    }
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      structuredLog('warn', '[classifier] Workers AI primary circuit OPEN — skipping to fallback');
    } else {
      structuredLog('warn', '[classifier] Primary model threw error', { fallback: FALLBACK_MODEL, error: String(err) });
    }
  }

  if (!parsed && gemma_fallback_enabled) {
    modelUsed = FALLBACK_MODEL;
    try {
      let response: { response?: string };
      if (kv) {
        const cb = new CircuitBreaker('ai-fallback', kv, { failureThreshold: 3 });
        response = await cb.execute(() => runModel(ai, FALLBACK_MODEL, messages));
      } else {
        response = await runModel(ai, FALLBACK_MODEL, messages);
      }
      parsed = parseAiResponse(response.response);
      if (parsed) {
        structuredLog('debug', '[classifier] Fallback model used', { model: FALLBACK_MODEL });
      }
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        structuredLog('warn', '[classifier] Workers AI fallback circuit OPEN — returning default result');
      } else {
        structuredLog('error', '[classifier] Fallback model also failed', { error: String(err) });
      }
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
