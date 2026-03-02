import { describe, it, expect } from 'vitest';
import { QUIZ_QUESTIONS } from '../data/quizzes';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeApp() {
  // Minimal KV stub
  const store = new Map<string, string>();
  const kvStub = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
  };

  const env = { CACHE: kvStub } as unknown as Parameters<typeof import('../routes/quiz')['quiz']['fetch']>[1];
  return { env };
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  env?: unknown,
) {
  const { quiz } = await import('../routes/quiz');
  const { env: defaultEnv } = makeApp();
  const resolvedEnv = env ?? defaultEnv;

  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  const req = new Request(`http://localhost${path}`, init);
  return quiz.fetch(req, resolvedEnv as never, {} as ExecutionContext);
}

// ── data sanity ────────────────────────────────────────────────────────────────

describe('QUIZ_QUESTIONS data', () => {
  it('has at least 20 questions', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(20);
  });

  it('all questions have unique ids', () => {
    const ids = QUIZ_QUESTIONS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all questions have valid type', () => {
    const validTypes = ['real_sau_frauda', 'gaseste_semnalele', 'ce_faci_daca'];
    for (const q of QUIZ_QUESTIONS) {
      expect(validTypes).toContain(q.type);
    }
  });
});

// ── GET /api/quiz ──────────────────────────────────────────────────────────────

describe('GET /api/quiz', () => {
  it('returns 10 questions', async () => {
    const res = await request('GET', '/api/quiz');
    expect(res.status).toBe(200);
    const json = await res.json() as { questions: unknown[]; total: number };
    expect(json.questions).toHaveLength(10);
    expect(json.total).toBe(10);
  });

  it('does not expose is_scam field on real_sau_frauda questions', async () => {
    const res = await request('GET', '/api/quiz');
    const json = await res.json() as { questions: Record<string, unknown>[] };
    const fraudaQ = json.questions.find((q) => q['type'] === 'real_sau_frauda');
    if (fraudaQ) {
      expect(fraudaQ).not.toHaveProperty('is_scam');
      expect(fraudaQ).not.toHaveProperty('red_flags');
      expect(fraudaQ).not.toHaveProperty('explanation');
    }
  });

  it('does not expose red_flags_in_text on gaseste_semnalele questions', async () => {
    const res = await request('GET', '/api/quiz');
    const json = await res.json() as { questions: Record<string, unknown>[] };
    const q = json.questions.find((q) => q['type'] === 'gaseste_semnalele');
    if (q) {
      expect(q).not.toHaveProperty('red_flags_in_text');
    }
  });

  it('does not expose correct flag on ce_faci_daca options', async () => {
    const res = await request('GET', '/api/quiz');
    const json = await res.json() as { questions: Record<string, unknown>[] };
    const q = json.questions.find((q) => q['type'] === 'ce_faci_daca') as Record<string, unknown> | undefined;
    if (q) {
      expect(q).not.toHaveProperty('explanation');
      const options = q['options'] as Record<string, unknown>[];
      for (const opt of options) {
        expect(opt).not.toHaveProperty('correct');
      }
    }
  });

  it('returns shuffled questions (probabilistic — different order across 3 calls)', async () => {
    const orders: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request('GET', '/api/quiz');
      const json = await res.json() as { questions: { id: string }[] };
      orders.push(json.questions.map((q) => q.id).join(','));
    }
    // At least two of three calls should differ (extremely unlikely to be all same)
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBeGreaterThan(1);
  });
});

// ── GET /api/quiz/:id ──────────────────────────────────────────────────────────

describe('GET /api/quiz/:id', () => {
  it('returns a question by id without answers', async () => {
    const res = await request('GET', '/api/quiz/q1');
    expect(res.status).toBe(200);
    const json = await res.json() as { question: Record<string, unknown> };
    expect(json.question.id).toBe('q1');
    expect(json.question).not.toHaveProperty('is_scam');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request('GET', '/api/quiz/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ── POST /api/quiz/check ───────────────────────────────────────────────────────

describe('POST /api/quiz/check', () => {
  it('returns correct=true for correct is_scam answer on q1', async () => {
    const res = await request('POST', '/api/quiz/check', { questionId: 'q1', answer: true });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean; explanation: string };
    expect(json.correct).toBe(true);
    expect(typeof json.explanation).toBe('string');
  });

  it('returns correct=false for wrong is_scam answer on q1', async () => {
    const res = await request('POST', '/api/quiz/check', { questionId: 'q1', answer: false });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean };
    expect(json.correct).toBe(false);
  });

  it('returns correct=true for correct real message (q3 — not scam)', async () => {
    const res = await request('POST', '/api/quiz/check', { questionId: 'q3', answer: false });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean };
    expect(json.correct).toBe(true);
  });

  it('returns explanation and red_flags_in_text for gaseste_semnalele check (q10)', async () => {
    const allFlags = ['anaf-plati.ro', 'executat silit în 24h', '247 RON'];
    const res = await request('POST', '/api/quiz/check', { questionId: 'q10', answer: allFlags });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean; found: string[]; missed: string[] };
    expect(json.correct).toBe(true);
    expect(json.found).toHaveLength(3);
    expect(json.missed).toHaveLength(0);
  });

  it('returns correct=false when user misses red flags on gaseste_semnalele (q10)', async () => {
    const res = await request('POST', '/api/quiz/check', {
      questionId: 'q10',
      answer: ['anaf-plati.ro'],
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean; missed: string[] };
    expect(json.correct).toBe(false);
    expect(json.missed.length).toBeGreaterThan(0);
  });

  it('returns correct=true for all correct options on ce_faci_daca (q15)', async () => {
    const res = await request('POST', '/api/quiz/check', {
      questionId: 'q15',
      answer: ['Ignor mesajul și verific pe ai-grija.ro', 'Sun la 112 să confirm amenda'],
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean; explanation: string };
    expect(json.correct).toBe(true);
    expect(typeof json.explanation).toBe('string');
  });

  it('returns correct=false when wrong option chosen on ce_faci_daca (q15)', async () => {
    const res = await request('POST', '/api/quiz/check', {
      questionId: 'q15',
      answer: ['Plătesc imediat să nu am probleme'],
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { correct: boolean };
    expect(json.correct).toBe(false);
  });

  it('returns 400 when questionId is missing', async () => {
    const res = await request('POST', '/api/quiz/check', { answer: true });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown questionId', async () => {
    const res = await request('POST', '/api/quiz/check', { questionId: 'nonexistent', answer: true });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { quiz } = await import('../routes/quiz');
    const { env } = makeApp();
    const req = new Request('http://localhost/api/quiz/check', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await quiz.fetch(req, env as never, {} as ExecutionContext);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/quiz?lang= ────────────────────────────────────────────────────────

describe('GET /api/quiz with lang param', () => {
  it('returns 10 questions for lang=ro (default)', async () => {
    const res = await request('GET', '/api/quiz?lang=ro');
    expect(res.status).toBe(200);
    const json = await res.json() as { questions: { id: string }[]; lang: string };
    expect(json.questions).toHaveLength(10);
    expect(json.lang).toBe('ro');
    // All returned question ids should correspond to ro questions
    for (const q of json.questions) {
      expect(q.id).not.toMatch(/-en$|-bg$|-hu$|-uk$/);
    }
  });

  it('returns 10 english questions for lang=en', async () => {
    const res = await request('GET', '/api/quiz?lang=en');
    expect(res.status).toBe(200);
    const json = await res.json() as { questions: { id: string }[]; lang: string };
    expect(json.questions).toHaveLength(10);
    expect(json.lang).toBe('en');
    for (const q of json.questions) {
      expect(q.id).toMatch(/-en$/);
    }
  });

  it('falls back to ro when lang has fewer than 10 questions', async () => {
    // bg has fewer than 10 questions in our dataset, should fall back to ro
    const res = await request('GET', '/api/quiz?lang=bg');
    expect(res.status).toBe(200);
    const json = await res.json() as { questions: { id: string }[]; lang: string };
    expect(json.questions).toHaveLength(10);
  });

  it('defaults to ro for unknown lang param', async () => {
    const res = await request('GET', '/api/quiz?lang=fr');
    expect(res.status).toBe(200);
    const json = await res.json() as { questions: { id: string }[]; lang: string };
    expect(json.lang).toBe('ro');
    expect(json.questions).toHaveLength(10);
  });

  it('returns lang field in response', async () => {
    const res = await request('GET', '/api/quiz');
    expect(res.status).toBe(200);
    const json = await res.json() as { lang: string };
    expect(json.lang).toBe('ro');
  });
});

describe('QUIZ_QUESTIONS multilingual data', () => {
  it('has lang field on all questions', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(['ro', 'en', 'bg', 'hu', 'uk']).toContain((q as { lang: string }).lang);
    }
  });

  it('has at least 23 ro questions', () => {
    const ro = QUIZ_QUESTIONS.filter((q) => (q as { lang: string }).lang === 'ro');
    expect(ro.length).toBeGreaterThanOrEqual(23);
  });

  it('has at least 23 en questions', () => {
    const en = QUIZ_QUESTIONS.filter((q) => (q as { lang: string }).lang === 'en');
    expect(en.length).toBeGreaterThanOrEqual(23);
  });

  it('all questions have unique ids across all languages', () => {
    const ids = QUIZ_QUESTIONS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
