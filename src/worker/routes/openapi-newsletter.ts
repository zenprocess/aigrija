import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { checkRateLimit, applyRateLimitHeaders } from '../lib/rate-limiter';
import { recordConsent, revokeConsent } from '../lib/gdpr-consent';
import { withCircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker';

const BUTTONDOWN_BASE = 'https://api.buttondown.com/v1';

const EmailSchema = z.object({
  email: z.string().email('Adresa de email este invalida.'),
});

export class NewsletterSubscribeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Newsletter'],
    summary: 'Abonare la newsletter',
    description: 'Aboneaza o adresa de email la newsletter-ul platformei (via Buttondown).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: EmailSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Abonare reusita',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), message: z.string() }),
          },
        },
      },
      '400': {
        description: 'Adresa deja abonata sau invalida',
      },
      '429': {
        description: 'Prea multe incercari',
      },
      '503': {
        description: 'Serviciu indisponibil',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const rl = await checkRateLimit(c.env.CACHE, `newsletter:${ip}`, 5, 60);
    applyRateLimitHeaders((k, v) => c.header(k, v), rl);

    if (!rl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe incercari. Incearca din nou in cateva minute.' } }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere invalid.' } }, 400);
    }

    const parsed = EmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join('; ') } }, 400);
    }

    const { email } = parsed.data;
    const apiKey = c.env.BUTTONDOWN_API_KEY;

    if (!apiKey) {
      return c.json({ error: { code: 'MISCONFIGURED', message: 'Serviciul nu este configurat.' } }, 503);
    }

    let bdRes: Response;
    try {
      bdRes = await withCircuitBreaker(c.env.CACHE, 'buttondown', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          return await fetch(`${BUTTONDOWN_BASE}/subscribers`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, type: 'regular' }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      }, { failureThreshold: 5, resetTimeout: 30_000 });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil.' } }, 503);
      }
      return c.json({ error: { code: 'UPSTREAM_ERROR', message: 'Eroare la procesarea abonarii. Incearca din nou.' } }, 502);
    }

    if (!bdRes.ok) {
      if (bdRes.status === 400) {
        return c.json({ error: { code: 'ALREADY_SUBSCRIBED', message: 'Aceasta adresa este deja abonata sau invalida.' } }, 400);
      }
      return c.json({ error: { code: 'UPSTREAM_ERROR', message: 'Eroare la procesarea abonarii. Incearca din nou.' } }, 502);
    }

    await recordConsent(c.env, 'email', email).catch(() => {});
    return c.json({ ok: true, message: 'Verifica email-ul pentru confirmare.' });
  }
}

export class NewsletterUnsubscribeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Newsletter'],
    summary: 'Dezabonare de la newsletter',
    description: 'Dezaboneaza o adresa de email de la newsletter-ul platformei.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: EmailSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Dezabonare reusita',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), message: z.string() }),
          },
        },
      },
      '400': {
        description: 'Date invalide',
      },
      '404': {
        description: 'Adresa nu este abonata',
      },
      '429': {
        description: 'Prea multe incercari',
      },
      '503': {
        description: 'Serviciu indisponibil',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const rl = await checkRateLimit(c.env.CACHE, `newsletter:${ip}`, 5, 60);
    applyRateLimitHeaders((k, v) => c.header(k, v), rl);

    if (!rl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe incercari. Incearca din nou in cateva minute.' } }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere invalid.' } }, 400);
    }

    const parsed = EmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join('; ') } }, 400);
    }

    const { email } = parsed.data;
    const apiKey = c.env.BUTTONDOWN_API_KEY;

    if (!apiKey) {
      return c.json({ error: { code: 'MISCONFIGURED', message: 'Serviciul nu este configurat.' } }, 503);
    }

    let bdRes: Response;
    try {
      bdRes = await withCircuitBreaker(c.env.CACHE, 'buttondown', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          return await fetch(`${BUTTONDOWN_BASE}/subscribers/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Token ${apiKey}` },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      }, { failureThreshold: 5, resetTimeout: 30_000 });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil.' } }, 503);
      }
      return c.json({ error: { code: 'UPSTREAM_ERROR', message: 'Eroare la procesarea dezabonarii. Incearca din nou.' } }, 502);
    }

    if (bdRes.status === 404) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Aceasta adresa nu este abonata.' } }, 404);
    }

    if (!bdRes.ok) {
      return c.json({ error: { code: 'UPSTREAM_ERROR', message: 'Eroare la procesarea dezabonarii. Incearca din nou.' } }, 502);
    }

    await revokeConsent(c.env, 'email', email).catch(() => {});
    return c.json({ ok: true, message: 'Ai fost dezabonat cu succes.' });
  }
}
