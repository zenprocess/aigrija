import { Hono } from 'hono';
import { QUIZ_QUESTIONS, } from '../data/quizzes';
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';
const quiz = new Hono();
const QUIZ_LIMIT = 50;
const QUIZ_WINDOW = ROUTE_RATE_LIMITS['check'].windowSeconds; // 3600s
/** Fisher-Yates shuffle — returns a new array */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Strip answer fields before sending to client */
function sanitizeQuestion(q) {
    if (q.type === 'real_sau_frauda') {
        const { is_scam, red_flags, explanation, ...safe } = q;
        void is_scam;
        void red_flags;
        void explanation;
        return safe;
    }
    if (q.type === 'gaseste_semnalele') {
        const { red_flags_in_text, ...safe } = q;
        void red_flags_in_text;
        return safe;
    }
    if (q.type === 'ce_faci_daca') {
        const { explanation, options, ...safe } = q;
        void explanation;
        // Strip correct flag from options
        const sanitizedOptions = options.map(({ text }) => ({ text }));
        return { ...safe, options: sanitizedOptions };
    }
    return q;
}
const SUPPORTED_LANGS = ['ro', 'en', 'bg', 'hu', 'uk'];
// GET /api/quiz — 10 random questions without answers
// Optional ?lang=ro|en|bg|hu|uk (default: ro)
quiz.get('/api/quiz', async (c) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const rl = await checkRateLimit(c.env.CACHE, `quiz:${ip}`, QUIZ_LIMIT, QUIZ_WINDOW);
    applyRateLimitHeaders((name, value) => c.header(name, value), rl);
    if (!rl.allowed) {
        return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe cereri. Reîncercați mai târziu.' } }, 429);
    }
    const langParam = c.req.query('lang') ?? 'ro';
    const lang = SUPPORTED_LANGS.includes(langParam)
        ? langParam
        : 'ro';
    const filtered = QUIZ_QUESTIONS.filter((q) => q.lang === lang);
    // Fall back to 'ro' if this language has fewer than 10 questions
    const pool = filtered.length >= 10 ? filtered : QUIZ_QUESTIONS.filter((q) => q.lang === 'ro');
    const selected = shuffle(pool).slice(0, 10);
    return c.json({ questions: selected.map(sanitizeQuestion), total: selected.length, lang });
});
// GET /api/quiz/:id — specific question without answer
quiz.get('/api/quiz/:id', async (c) => {
    const id = c.req.param('id');
    const q = QUIZ_QUESTIONS.find((question) => question.id === id);
    if (!q) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Întrebarea nu există.' } }, 404);
    }
    return c.json({ question: sanitizeQuestion(q) });
});
// POST /api/quiz/check — check answer
quiz.post('/api/quiz/check', async (c) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const rl = await checkRateLimit(c.env.CACHE, `quiz-check:${ip}`, QUIZ_LIMIT, QUIZ_WINDOW);
    applyRateLimitHeaders((name, value) => c.header(name, value), rl);
    if (!rl.allowed) {
        return c.json({ error: { code: 'RATE_LIMITED', message: 'Prea multe cereri. Reîncercați mai târziu.' } }, 429);
    }
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ error: { code: 'BAD_REQUEST', message: 'Body JSON invalid.' } }, 400);
    }
    const { questionId, answer } = body;
    if (!questionId) {
        return c.json({ error: { code: 'BAD_REQUEST', message: 'Câmpul questionId este obligatoriu.' } }, 400);
    }
    const q = QUIZ_QUESTIONS.find((question) => question.id === questionId);
    if (!q) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Întrebarea nu există.' } }, 404);
    }
    if (q.type === 'real_sau_frauda') {
        const correct = answer === q.is_scam;
        return c.json({
            correct,
            explanation: q.explanation,
            red_flags: q.red_flags,
            is_scam: q.is_scam,
        });
    }
    if (q.type === 'gaseste_semnalele') {
        // answer should be an array of text strings the user identified as red flags
        const userFlags = Array.isArray(answer) ? answer : [];
        const correctTexts = q.red_flags_in_text.map((f) => f.text);
        const found = userFlags.filter((t) => correctTexts.includes(t));
        const missed = correctTexts.filter((t) => !userFlags.includes(t));
        const correct = found.length === correctTexts.length && missed.length === 0;
        return c.json({
            correct,
            found,
            missed,
            red_flags_in_text: q.red_flags_in_text,
        });
    }
    if (q.type === 'ce_faci_daca') {
        // answer should be an array of option texts chosen by user
        const userChoices = Array.isArray(answer) ? answer : [];
        const correctOptions = q.options.filter((o) => o.correct).map((o) => o.text);
        const allCorrectChosen = correctOptions.every((t) => userChoices.includes(t));
        const noWrongChosen = userChoices.every((t) => q.options.find((o) => o.text === t)?.correct === true);
        const correct = allCorrectChosen && noWrongChosen;
        return c.json({
            correct,
            explanation: q.explanation,
            correct_options: correctOptions,
            options: q.options,
        });
    }
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Tip de întrebare necunoscut.' } }, 400);
});
export { quiz };
