import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import { generateWeeklyDigest } from '../lib/weekly-digest';
import { structuredLog } from '../lib/logger';
import { createRateLimiter, applyRateLimitHeaders, getRouteRateLimit } from '../lib/rate-limiter';
import { recordConsent, revokeConsent } from '../lib/gdpr-consent';

const BUTTONDOWN_BASE = 'https://api.buttondown.com/v1';

const DigestEmailSchema = z.object({
  email: z.string().email('Adresa de e-mail invalida.'),
});

const ScamSchema = z.object({
  title: z.string(),
  url: z.string(),
  reportCount: z.number(),
  severity: z.string(),
});

const StatsSchema = z.object({
  totalChecks: z.number(),
  totalAlerts: z.number(),
  quizCompletions: z.number(),
  communityReports: z.number(),
});

const PostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  date: z.string(),
});

const DigestSchema = z.object({
  weekOf: z.string(),
  topScams: z.array(ScamSchema),
  stats: StatsSchema,
  blogPosts: z.array(PostSchema),
  tips: z.array(z.string()),
});

const DigestResponseSchema = z.object({
  ok: z.boolean(),
  digest: DigestSchema,
});

export class DigestLatestEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Digest'],
    summary: 'Ultimul digest saptamanal',
    description: 'Returneaza cel mai recent digest saptamanal cu top campanii de frauda, statistici si sfaturi.',
    responses: {
      '200': {
        description: 'Digestul saptamanal',
        content: {
          'application/json': {
            schema: DigestResponseSchema,
          },
        },
      },
      '503': {
        description: 'Digest indisponibil momentan',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    try {
      const digest = await generateWeeklyDigest(c.env);
      c.header('Cache-Control', 'public, max-age=3600');
      return c.json({ ok: true, digest });
    } catch (err) {
      structuredLog('error', 'weekly_digest_api_failed', { error: String(err) });
      return c.json({ ok: false, error: 'Digest indisponibil momentan.' }, 503);
    }
  }
}

export class DigestSubscribeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Digest'],
    summary: 'Abonare la digestul saptamanal',
    description: 'Aboneaza o adresa de email la digestul saptamanal de securitate cibernetica (via Buttondown, tag: digest).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: DigestEmailSchema,
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
      '422': {
        description: 'Date de validare invalide',
      },
      '429': {
        description: 'Prea multe cereri',
      },
      '503': {
        description: 'Serviciu indisponibil',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const subIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const subRlCfg = getRouteRateLimit('digest-subscribe', c.env);
    const subRl = await createRateLimiter(c.env.CACHE)(`digest-sub:${subIp}`, subRlCfg.limit, subRlCfg.windowSeconds);
    applyRateLimitHeaders((k, v) => c.header(k, v), subRl);
    if (!subRl.allowed) {
      return c.json({ ok: false, error: 'Prea multe cereri. Incearca din nou mai tarziu.' }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'JSON invalid.' }, 400);
    }

    const parsed = DigestEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues.map(i => i.message).join('; ') }, 422);
    }

    const apiKey = c.env.BUTTONDOWN_API_KEY;
    if (!apiKey) {
      return c.json({ ok: false, error: 'Serviciu indisponibil momentan.' }, 503);
    }

    const bdRes = await fetch(`${BUTTONDOWN_BASE}/subscribers`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.email, type: 'regular', tags: ['digest'] }),
    });

    if (!bdRes.ok) {
      if (bdRes.status === 400) {
        return c.json({ ok: false, error: 'Aceasta adresa este deja abonata sau invalida.' }, 400);
      }
      const bdBody = await bdRes.json().catch(() => ({})) as Record<string, unknown>;
      structuredLog('error', 'digest_subscribe_upstream_error', { status: bdRes.status, body: bdBody });
      return c.json({ ok: false, error: 'Eroare la procesarea abonarii. Incearca din nou.' }, 502);
    }

    await recordConsent(c.env, 'email', parsed.data.email).catch(() => {});
    return c.json({ ok: true, message: 'Verifica email-ul pentru confirmare.' });
  }
}

export class DigestUnsubscribeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Digest'],
    summary: 'Dezabonare de la digestul saptamanal',
    description: 'Dezaboneaza o adresa de email de la digestul saptamanal.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: DigestEmailSchema,
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
      '404': {
        description: 'Adresa nu este abonata',
      },
      '422': {
        description: 'Date de validare invalide',
      },
      '429': {
        description: 'Prea multe cereri',
      },
      '503': {
        description: 'Serviciu indisponibil',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const unsubIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const unsubRlCfg = getRouteRateLimit('digest-unsubscribe', c.env);
    const unsubRl = await createRateLimiter(c.env.CACHE)(`digest-unsub:${unsubIp}`, unsubRlCfg.limit, unsubRlCfg.windowSeconds);
    applyRateLimitHeaders((k, v) => c.header(k, v), unsubRl);
    if (!unsubRl.allowed) {
      return c.json({ ok: false, error: 'Prea multe cereri. Incearca din nou mai tarziu.' }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'JSON invalid.' }, 400);
    }

    const parsed = DigestEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues.map(i => i.message).join('; ') }, 422);
    }

    const apiKey = c.env.BUTTONDOWN_API_KEY;
    if (!apiKey) {
      return c.json({ ok: false, error: 'Serviciu indisponibil momentan.' }, 503);
    }

    const bdRes = await fetch(`${BUTTONDOWN_BASE}/subscribers/${encodeURIComponent(parsed.data.email)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${apiKey}` },
    });

    if (bdRes.status === 404) {
      return c.json({ ok: false, error: 'Aceasta adresa nu este abonata.' }, 404);
    }

    if (!bdRes.ok) {
      return c.json({ ok: false, error: 'Eroare la procesarea dezabonarii. Incearca din nou.' }, 502);
    }

    await revokeConsent(c.env, 'email', parsed.data.email).catch(() => {});
    return c.json({ ok: true, message: 'Ai fost dezabonat cu succes.' });
  }
}
