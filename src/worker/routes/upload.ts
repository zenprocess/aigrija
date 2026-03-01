import { Hono } from 'hono';
import type { Env, ClassificationResult } from '../lib/types';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
import { classify } from '../lib/classifier';
import { structuredLog } from '../lib/logger';
import { ImageUploadSchema, formatZodError } from '../lib/schemas';

const VISION_MODEL = '@cf/meta/llava-1.5-7b-hf';

const upload = new Hono<{ Bindings: Env }>();

export interface ImageCheckResponse {
  request_id: string;
  classification: ClassificationResult;
  image_analysis: string;
  rate_limit: { remaining: number; limit: number };
}

upload.post('/api/check/image', async (c) => {
  const rid = c.get('requestId' as never) as string;

  const ip = c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';

  const rl = await checkRateLimit(c.env.CACHE, ip, ROUTE_RATE_LIMITS['check-image'].limit, ROUTE_RATE_LIMITS['check-image'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  const { allowed, remaining, limit } = rl;

  if (!allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de verificari depasita. Incercati din nou mai tarziu.', request_id: rid } }, 429);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Request invalid. Trimiteti multipart/form-data.', request_id: rid } }, 400);
  }

  const imageFile = formData.get('image') as File | null;
  if (!imageFile || !(imageFile instanceof File)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Campul "image" lipseste sau nu este un fisier.', request_id: rid } }, 400);
  }

  const textContext = (formData.get('text') as string | null) || '';

  const uploadValidation = ImageUploadSchema.safeParse({
    mimeType: imageFile.type,
    size: imageFile.size,
    textContext,
  });

  if (!uploadValidation.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: formatZodError(uploadValidation.error),
        request_id: rid,
      },
    }, 400);
  }

  const validatedTextContext = uploadValidation.data.textContext;

  const imageBuffer = await imageFile.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer);

  const visionPrompt = validatedTextContext
    ? `Analizeaza aceasta captura de ecran a unui mesaj. Context suplimentar: ${validatedTextContext}. Este aceasta o tentativa de phishing, escrocherie sau un mesaj legitim? Cauta: URL-uri suspecte, limbaj de urgenta, uzurparea identitatii bancilor/institutiilor, solicitari de date personale. Raspunde in romana cu: verdict (phishing/suspect/sigur), explicatie, semnale de alarma gasite.`
    : 'Analizeaza aceasta captura de ecran a unui mesaj. Este aceasta o tentativa de phishing, escrocherie sau un mesaj legitim? Cauta: URL-uri suspecte, limbaj de urgenta, uzurparea identitatii bancilor/institutiilor, solicitari de date personale. Raspunde in romana cu: verdict (phishing/suspect/sigur), explicatie, semnale de alarma gasite.';

  let imageAnalysis = '';
  let visionVerdict: 'phishing' | 'suspicious' | 'likely_safe' = 'suspicious';

  try {
    const visionResult = await (c.env.AI.run as any)(VISION_MODEL, {
      image: Array.from(imageBytes),
      prompt: visionPrompt,
      max_tokens: 512,
    }) as { description?: string; response?: string };

    imageAnalysis = visionResult.description || visionResult.response || 'Analiza vizuala nu a putut fi finalizata.';

    const lower = imageAnalysis.toLowerCase();
    if (lower.includes('phishing') || lower.includes('frauda') || lower.includes('escrocherie')) {
      visionVerdict = 'phishing';
    } else if (lower.includes('suspect') || lower.includes('atentie') || lower.includes('posibil')) {
      visionVerdict = 'suspicious';
    } else if (lower.includes('sigur') || lower.includes('legitim') || lower.includes('oficial')) {
      visionVerdict = 'likely_safe';
    }
  } catch (err) {
    structuredLog('error', 'vision_model_failed', { error: String(err) });
    imageAnalysis = 'Analiza vizuala nu a putut fi finalizata. Modelul de viziune nu este disponibil.';
  }

  let classification: ClassificationResult;
  if (validatedTextContext && validatedTextContext.trim().length >= 3) {
    classification = await classify(c.env.AI, validatedTextContext);
    if (visionVerdict === 'phishing' && classification.verdict === 'likely_safe') {
      classification = { ...classification, verdict: 'suspicious' };
    }
  } else {
    classification = {
      verdict: visionVerdict,
      confidence: visionVerdict === 'phishing' ? 0.85 : visionVerdict === 'suspicious' ? 0.60 : 0.80,
      scam_type: visionVerdict === 'phishing' ? 'Detectat in imagine' : visionVerdict === 'suspicious' ? 'Posibil suspect' : 'Necunoscut',
      red_flags: visionVerdict !== 'likely_safe' ? ['Continut vizual suspect detectat'] : [],
      explanation: imageAnalysis,
      recommended_actions: visionVerdict === 'phishing'
        ? ['Nu accesati link-urile din imagine', 'Raportati la DNSC (1911)', 'Blocati expeditorul']
        : visionVerdict === 'suspicious'
        ? ['Tratati mesajul cu precautie', 'Verificati sursa prin canale oficiale']
        : ['Mesajul pare legitim dar ramati vigilent'],
      model_used: VISION_MODEL,
      ai_disclaimer: 'Analiza generata de AI. Rezultatele sunt orientative si nu constituie consiliere juridica.',
    };
  }

  const response: ImageCheckResponse = {
    request_id: rid,
    classification,
    image_analysis: imageAnalysis,
    rate_limit: { remaining, limit },
  };

  const countKey = 'stats:total_checks';
  const current = parseInt(await c.env.CACHE.get(countKey) || '0', 10);
  await c.env.CACHE.put(countKey, String(current + 1));

  // Store screenshot in R2 for audit trail.
  const ext = imageFile.type.split('/')[1] || 'bin';
  c.executionCtx.waitUntil(
    c.env.STORAGE.put('screenshots/' + rid + '.' + ext, imageBuffer, {
      httpMetadata: { contentType: imageFile.type },
      customMetadata: { uploadedAt: new Date().toISOString(), verdict: classification.verdict },
    })
  );

  return c.json(response);
});

export { upload };
