import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { ImageUploadSchema, formatZodError } from '../lib/schemas';
import { createRateLimiter, applyRateLimitHeaders, getRouteRateLimit } from '../lib/rate-limiter';
import { createClassifier } from '../lib/classifier';
import { structuredLog } from '../lib/logger';
import { VISION_MODEL } from '../lib/constants';
import { uint8ArrayToBase64 } from '../lib/encoding';
import { validateVisionResponse, calibrateConfidence } from '../lib/vision-validator';

const ClassificationSchema = z.object({
  verdict: z.enum(['phishing', 'suspicious', 'likely_safe']),
  confidence: z.number().min(0).max(1),
  scam_type: z.string(),
  impersonated_entity: z.string().optional(),
  red_flags: z.array(z.string()),
  explanation: z.string(),
  recommended_actions: z.array(z.string()),
  model_used: z.string(),
  ai_disclaimer: z.string(),
});

const ImageCheckResponseSchema = z.object({
  request_id: z.string(),
  classification: ClassificationSchema,
  image_analysis: z.string().describe('Rezultatul analizei vizuale a imaginii'),
  rate_limit: z.object({
    remaining: z.number(),
    limit: z.number(),
  }),
});

export class CheckImageEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Analysis'],
    summary: 'Analizeaza o imagine pentru detectia fraudelor',
    description: 'Trimite o captura de ecran (PNG, JPG, WEBP, max 5MB) pentru analiza vizuala AI. Detecteaza phishing, fraude si mesaje suspecte din imagini.',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              image: z.any().describe('Fisierul imagine (PNG, JPG sau WEBP, max 5MB)'),
              text: z.string().optional().describe('Context suplimentar optional pentru analiza'),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Rezultatul analizei imaginii',
        content: {
          'application/json': {
            schema: ImageCheckResponseSchema,
          },
        },
      },
      '400': {
        description: 'Date invalide (format imagine nesuportat, fisier prea mare)',
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

    const rlCfg = getRouteRateLimit('check-image', c.env);
    const rl = await createRateLimiter(c.env.CACHE)(ip, rlCfg.limit, rlCfg.windowSeconds);
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
      return c.json({ error: { code: 'VALIDATION_ERROR', message: formatZodError(uploadValidation.error), request_id: rid } }, 400);
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
      const base64Image = uint8ArrayToBase64(imageBytes);
      const dataUri = `data:${imageFile.type};base64,${base64Image}`;

      // Accept Llama 3.2 license if not yet accepted (cached in KV)
      const licenseKey = `ai:license:${VISION_MODEL}`;
      if (!(await c.env.CACHE.get(licenseKey))) {
        try {
          await (c.env.AI.run as any)(VISION_MODEL, { prompt: "agree", max_tokens: 1 });
          await c.env.CACHE.put(licenseKey, "1", { expirationTtl: 86400 * 30 });
        } catch { /* already accepted or irrelevant */ }
      }

      const visionResult = await (c.env.AI.run as unknown as (model: string, input: { messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>; max_tokens: number }) => Promise<{ response?: string }>)(VISION_MODEL, {
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: visionPrompt },
          ],
        }],
        max_tokens: 512,
      });

      imageAnalysis = visionResult.response || 'Analiza vizuala nu a putut fi finalizata.';

      if (!validateVisionResponse(imageAnalysis)) {
        structuredLog('warn', 'vision_response_invalid', { response: imageAnalysis.slice(0, 100) });
        imageAnalysis = '';
        visionVerdict = 'suspicious';
      } else {
        const lower = imageAnalysis.toLowerCase();
        if (lower.includes('phishing') || lower.includes('frauda') || lower.includes('escrocherie')) {
          visionVerdict = 'phishing';
        } else if (lower.includes('suspect') || lower.includes('atentie') || lower.includes('posibil')) {
          visionVerdict = 'suspicious';
        } else if (lower.includes('sigur') || lower.includes('legitim') || lower.includes('oficial')) {
          visionVerdict = 'likely_safe';
        }
      }
    } catch (err) {
      structuredLog('error', 'vision_model_failed', { error: String(err) });
      imageAnalysis = '';
      visionVerdict = 'suspicious';
    }

    let classification;
    if (validatedTextContext && validatedTextContext.trim().length >= 3) {
      classification = await createClassifier(c.env.AI, c.env.CACHE)(validatedTextContext);
      if (visionVerdict === 'phishing' && classification.verdict === 'likely_safe') {
        classification = { ...classification, verdict: 'suspicious' as const };
      }
    } else if (!imageAnalysis) {
      classification = {
        verdict: 'suspicious' as const,
        confidence: 0.0,
        scam_type: 'Analiza indisponibila',
        red_flags: [] as string[],
        explanation: 'Analiza vizuala nu este disponibila momentan. Va rugam sa incercati din nou sau sa furnizati textul mesajului.',
        recommended_actions: ['Incercati din nou mai tarziu', 'Furnizati textul mesajului pentru analiza text'],
        model_used: VISION_MODEL,
        ai_disclaimer: 'Analiza generata de AI. Rezultatele sunt orientative si nu constituie consiliere juridica.',
      };
    } else {
      const confidence = calibrateConfidence(imageAnalysis, visionVerdict);
      classification = {
        verdict: visionVerdict,
        confidence,
        scam_type: visionVerdict === 'phishing' ? 'Detectat in imagine' : visionVerdict === 'suspicious' ? 'Posibil suspect' : 'Necunoscut',
        red_flags: visionVerdict !== 'likely_safe' ? ['Continut vizual suspect detectat'] : [] as string[],
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

    const countKey = 'stats:total_checks';
    const current = parseInt(await c.env.CACHE.get(countKey) || '0', 10);
    await c.env.CACHE.put(countKey, String(current + 1));

    const ext = imageFile.type.split('/')[1] || 'bin';
    c.executionCtx.waitUntil(
      c.env.STORAGE.put('screenshots/' + rid + '.' + ext, imageBuffer, {
        httpMetadata: { contentType: imageFile.type },
        customMetadata: { uploadedAt: new Date().toISOString(), verdict: classification.verdict },
      })
    );

    return c.json({
      request_id: rid,
      classification,
      image_analysis: imageAnalysis,
      rate_limit: { remaining, limit },
    });
  }
}
