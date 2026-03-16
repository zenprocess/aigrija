import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import {
  QUIZ_QUESTIONS,
  type QuizQuestion,
  type RealSauFrauda,
  type GasesteSemnalele,
  type CeFaciDaca,
} from '../data/quizzes';
import { createRateLimiter, applyRateLimitHeaders, getRouteRateLimit, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';

const QUIZ_LIMIT = 50;
const QUIZ_WINDOW = ROUTE_RATE_LIMITS['check'].windowSeconds;
const SUPPORTED_LANGS = ['ro', 'en', 'bg', 'hu', 'uk'] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeQuestion(q: QuizQuestion): Record<string, unknown> {
  if (q.type === 'real_sau_frauda') {
    const { is_scam, red_flags, explanation, ...safe } = q as RealSauFrauda;
    void is_scam; void red_flags; void explanation;
    return safe;
  }
  if (q.type === 'gaseste_semnalele') {
    const { red_flags_in_text, ...safe } = q as GasesteSemnalele;
    void red_flags_in_text;
    return safe;
  }
  if (q.type === 'ce_faci_daca') {
    const { explanation, options, ...safe } = q as CeFaciDaca;
    void explanation;
    const sanitizedOptions = options.map(({ text }) => ({ text }));
    return { ...safe, options: sanitizedOptions };
  }
  return q as Record<string, unknown>;
}

const QuizResponseSchema = z.object({
  questions: z.array(z.record(z.string(), z.unknown())).describe('Lista de intrebari (fara raspunsuri)'),
  total: z.number().describe('Numarul de intrebari returnate'),
  lang: z.string().describe('Limba intrebarilor'),
});

const QuizCheckRequestSchema = z.object({
  questionId: z.string().describe('ID-ul intrebarii'),
  answer: z.unknown().describe('Raspunsul utilizatorului'),
});

export class QuizEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Quiz'],
    summary: 'Obtine intrebari de quiz',
    description: 'Returneaza 10 intrebari aleatoare de quiz anti-frauda, fara raspunsuri. Suporta mai multe limbi.',
    request: {
      query: z.object({
        lang: z.enum(SUPPORTED_LANGS).optional().describe('Limba intrebarilor (implicit: ro)'),
      }),
    },
    responses: {
      '200': {
        description: 'Lista de intrebari',
        content: {
          'application/json': {
            schema: QuizResponseSchema,
          },
        },
      },
      '429': {
        description: 'Prea multe cereri',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = await createRateLimiter(c.env.CACHE)(`quiz:${ip}`, QUIZ_LIMIT, QUIZ_WINDOW);
    applyRateLimitHeaders((name, value) => c.header(name, value), rl);

    if (!rl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe cereri. Reincercati mai tarziu.' } }, 429);
    }

    const langParam = c.req.query('lang') ?? 'ro';
    const lang = SUPPORTED_LANGS.includes(langParam as typeof SUPPORTED_LANGS[number])
      ? (langParam as typeof SUPPORTED_LANGS[number])
      : 'ro';

    const filtered = QUIZ_QUESTIONS.filter(q => q.lang === lang);
    const pool = filtered.length >= 10 ? filtered : QUIZ_QUESTIONS.filter(q => q.lang === 'ro');
    const selected = shuffle(pool).slice(0, 10);
    return c.json({ questions: selected.map(sanitizeQuestion), total: selected.length, lang });
  }
}

export class QuizCheckEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Quiz'],
    summary: 'Verifica raspunsul la o intrebare de quiz',
    description: 'Trimite raspunsul la o intrebare si primeste feedback (corect/gresit, explicatie, red flags).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: QuizCheckRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Rezultatul verificarii',
        content: {
          'application/json': {
            schema: z.object({
              correct: z.boolean(),
              explanation: z.string().optional(),
              red_flags: z.array(z.string()).optional(),
            }),
          },
        },
      },
      '400': {
        description: 'Date invalide',
      },
      '404': {
        description: 'Intrebarea nu exista',
      },
      '429': {
        description: 'Prea multe cereri',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
    const rlCfg = getRouteRateLimit('quiz-check', c.env);
    const rl = await createRateLimiter(c.env.CACHE)(`quiz-check:${ip}`, rlCfg.limit, rlCfg.windowSeconds);
    applyRateLimitHeaders((name, value) => c.header(name, value), rl);

    if (!rl.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe cereri. Reincercati mai tarziu.' } }, 429);
    }

    let body: { questionId?: string; answer?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Body JSON invalid.' } }, 400);
    }

    const { questionId, answer } = body;
    if (!questionId) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Campul questionId este obligatoriu.' } }, 400);
    }

    const q = QUIZ_QUESTIONS.find(question => question.id === questionId);
    if (!q) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Intrebarea nu exista.' } }, 404);
    }

    if (q.type === 'real_sau_frauda') {
      const correct = answer === q.is_scam;
      return c.json({ correct, explanation: q.explanation, red_flags: q.red_flags, is_scam: q.is_scam });
    }

    if (q.type === 'gaseste_semnalele') {
      const userFlags: string[] = Array.isArray(answer) ? (answer as string[]) : [];
      const correctTexts = q.red_flags_in_text.map(f => f.text);
      const found = userFlags.filter(t => correctTexts.includes(t));
      const missed = correctTexts.filter(t => !userFlags.includes(t));
      const correct = found.length === correctTexts.length && missed.length === 0;
      return c.json({ correct, found, missed, red_flags_in_text: q.red_flags_in_text });
    }

    if (q.type === 'ce_faci_daca') {
      const userChoices: string[] = Array.isArray(answer) ? (answer as string[]) : [];
      const correctOptions = q.options.filter(o => o.correct).map(o => o.text);
      const allCorrectChosen = correctOptions.every(t => userChoices.includes(t));
      const noWrongChosen = userChoices.every(t => q.options.find(o => o.text === t)?.correct === true);
      const correct = allCorrectChosen && noWrongChosen;
      return c.json({ correct, explanation: q.explanation, correct_options: correctOptions, options: q.options });
    }

    return c.json({ error: { code: 'BAD_REQUEST', message: 'Tip de intrebare necunoscut.' } }, 400);
  }
}
