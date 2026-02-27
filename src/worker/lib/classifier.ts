import type { ClassificationResult } from './types';

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

Raspunde STRICT in JSON conform schemei furnizate.`;

export async function classify(ai: Ai, text: string, url?: string): Promise<ClassificationResult> {
  const userMessage = url
    ? `Analizeaza acest mesaj si URL-ul asociat:\n\nMesaj: ${text}\nURL: ${url}`
    : `Analizeaza acest mesaj:\n\n${text}`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct-fast' as any, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  }) as { response?: string };

  try {
    const parsed = JSON.parse(response.response || '{}');
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
    return {
      verdict: 'suspicious',
      confidence: 0.3,
      scam_type: 'necunoscut',
      red_flags: ['Analiza automata nu a putut fi finalizata'],
      explanation: 'Mesajul a fost primit dar analiza automata nu a putut fi finalizata. Va recomandam prudenta.',
      recommended_actions: ['Tratati mesajul cu precautie', 'Raportati la DNSC (1911)'],
    };
  }
}
