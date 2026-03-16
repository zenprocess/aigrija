import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/types';
import { createRateLimiter, applyRateLimitHeaders } from '../lib/rate-limiter';
import { recordConsent, revokeConsent } from '../lib/gdpr-consent';
import { withCircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker';

const BUTTONDOWN_BASE = 'https://api.buttondown.com/v1';

const SubscribeSchema = z.object({
  email: z.string().email('Adresa de email este invalida.'),
});

const UnsubscribeSchema = z.object({
  email: z.string().email('Adresa de email este invalida.'),
});

const newsletter = new Hono<{ Bindings: Env }>();

newsletter.post('/api/newsletter/subscribe', async (c) => {
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const rl = await createRateLimiter(c.env.CACHE)(`newsletter:${ip}`, 5, 120);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);

  if (!rl.allowed) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Prea multe incercari. Incearca din nou in cateva minute.' } },
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere invalid.' } }, 400);
  }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join('; ') } },
      400
    );
  }

  const { email } = parsed.data;
  const apiKey = c.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    return c.json({ error: { code: 'MISCONFIGURED', message: 'Serviciul nu este configurat.' } }, 503);
  }

  let bdRes: Response;
  try {
    bdRes = await withCircuitBreaker(c.env.CACHE, 'buttondown', async () => {
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 5000);
      try {
        const res = await fetch(`${BUTTONDOWN_BASE}/subscribers`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, type: 'regular' }),
          signal: controller1.signal,
        });
        return res;
      } finally {
        clearTimeout(timeout1);
      }
    }, { failureThreshold: 5, resetTimeout: 30_000 });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return c.json(
        { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } },
        503
      );
    }
    return c.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } },
      503
    );
  }

  if (!bdRes.ok) {
    // 400 from Buttondown usually means already subscribed or invalid email
    if (bdRes.status === 400) {
      return c.json(
        { error: { code: 'ALREADY_SUBSCRIBED', message: 'Aceasta adresa este deja abonata sau invalida.' } },
        400
      );
    }
    if (bdRes.status === 401 || bdRes.status === 403) {
      console.error('Newsletter: Buttondown authentication failed — check BUTTONDOWN_API_KEY binding', { status: bdRes.status });
    }
    return c.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } },
      503
    );
  }

  await recordConsent(c.env, 'email', parsed.data.email).catch(() => {});
  return c.json({ ok: true, message: 'Verifica email-ul pentru confirmare.' });
});

newsletter.post('/api/newsletter/unsubscribe', async (c) => {
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const rl = await createRateLimiter(c.env.CACHE)(`newsletter:${ip}`, 5, 120);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);

  if (!rl.allowed) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Prea multe incercari. Incearca din nou in cateva minute.' } },
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Corp de cerere invalid.' } }, 400);
  }

  const parsed = UnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join('; ') } },
      400
    );
  }

  const { email } = parsed.data;
  const apiKey = c.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    return c.json({ error: { code: 'MISCONFIGURED', message: 'Serviciul nu este configurat.' } }, 503);
  }

  let bdRes: Response;
  try {
    bdRes = await withCircuitBreaker(c.env.CACHE, 'buttondown', async () => {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      try {
        const res = await fetch(`${BUTTONDOWN_BASE}/subscribers/${encodeURIComponent(email)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Token ${apiKey}`,
          },
          signal: controller2.signal,
        });
        return res;
      } finally {
        clearTimeout(timeout2);
      }
    }, { failureThreshold: 5, resetTimeout: 30_000 });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return c.json(
        { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } },
        503
      );
    }
    return c.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } },
      503
    );
  }

  if (bdRes.status === 404) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Aceasta adresa nu este abonata.' } }, 404);
  }

  if (!bdRes.ok) {
    if (bdRes.status === 401 || bdRes.status === 403) {
      console.error('Newsletter: Buttondown authentication failed — check BUTTONDOWN_API_KEY binding', { status: bdRes.status });
    }
    return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviciul de newsletter este temporar indisponibil. Incearca din nou mai tarziu.' } }, 503);
  }

  await revokeConsent(c.env, 'email', parsed.data.email).catch(() => {});
  return c.json({ ok: true, message: 'Ai fost dezabonat cu succes.' });
});

export { newsletter };
