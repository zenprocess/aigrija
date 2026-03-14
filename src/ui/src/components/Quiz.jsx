import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n/index.jsx';

// ─── helpers ─────────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-white/60 mb-1">
        <span>{current} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  );
}

function FeedbackBox({ correct, explanation, redFlags, correctLabel, incorrectLabel }) {
  return (
    <div
      className={cn(
        'mt-4 p-4 rounded-xl border text-sm',
        correct
          ? 'bg-green-500/10 border-green-500/30 text-green-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300',
      )}
      data-testid="quiz-feedback"
    >
      <p className="font-bold mb-1">{correct ? (correctLabel || '✓ Corect!') : (incorrectLabel || '✗ Incorect')}</p>
      {explanation && <p className="mb-2 text-white/80">{explanation}</p>}
      {redFlags && redFlags.length > 0 && (
        <ul className="list-disc list-inside space-y-1">
          {redFlags.map((f, i) => (
            <li key={i} className="text-white/70">{typeof f === 'string' ? f : `${f.text} — ${f.reason}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── question type renderers ─────────────────────────────────────────────────

const RealSauFraudaQuestion = React.memo(function RealSauFraudaQuestion({ question, onAnswer, answered, feedback }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-white/90 font-mono text-sm leading-relaxed">
        {question.message}
      </div>
      <div className="flex gap-3">
        <button
          data-testid="quiz-real-btn"
          disabled={answered}
          onClick={() => onAnswer(false)}
          aria-label={t('quiz.real_btn')}
          className={cn(
            'flex-1 py-3 px-6 rounded-xl font-semibold transition-all',
            answered ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105',
            'bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/30',
          )}
        >
          {t('quiz.real_btn')}
        </button>
        <button
          data-testid="quiz-fraud-btn"
          disabled={answered}
          onClick={() => onAnswer(true)}
          aria-label={t('quiz.fraud_btn')}
          className={cn(
            'flex-1 py-3 px-6 rounded-xl font-semibold transition-all',
            answered ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105',
            'bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30',
          )}
        >
          {t('quiz.fraud_btn')}
        </button>
      </div>
      {answered && feedback && (
        <FeedbackBox
          correct={feedback.correct}
          explanation={feedback.explanation}
          redFlags={feedback.red_flags}
          correctLabel={t('quiz.feedback_correct')}
          incorrectLabel={t('quiz.feedback_incorrect')}
        />
      )}
    </div>
  );
});

const GasesteSemnaleleQuestion = React.memo(function GasesteSemnaleleQuestion({ question, onAnswer, answered, feedback }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);

  const words = question.message.split(/(\s+)/);

  function toggleWord(word) {
    if (answered) return;
    const clean = word.trim();
    if (!clean) return;
    setSelected((prev) =>
      prev.includes(clean) ? prev.filter((w) => w !== clean) : [...prev, clean],
    );
  }

  function isRedFlagWord(word) {
    if (!feedback) return false;
    return (feedback.red_flags_in_text || []).some((f) => f.text === word.trim());
  }

  function isSelected(word) {
    return selected.includes(word.trim());
  }

  return (
    <div>
      <p className="text-white/60 text-sm mb-3">{t('quiz.click_suspicious')}</p>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 text-white/90 text-sm leading-relaxed select-none">
        {words.map((word, i) => {
          const isSpace = /^\s+$/.test(word);
          if (isSpace) return <span key={i}>{word}</span>;
          const sel = isSelected(word);
          const isFlagged = answered && isRedFlagWord(word);
          return (
            <span
              key={i}
              data-testid={`quiz-word-${i}`}
              onClick={() => toggleWord(word)}
              role="button"
              tabIndex={answered ? -1 : 0}
              aria-pressed={sel}
              onKeyDown={(e) => { if (!answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleWord(word); } }}
              className={cn(
                'cursor-pointer rounded px-0.5 transition-colors',
                sel && !answered ? 'bg-purple-500/40 text-white' : '',
                answered && isFlagged ? 'bg-red-500/40 text-red-200 line-through' : '',
                answered && sel && !isFlagged ? 'bg-yellow-500/20 text-yellow-300' : '',
                !answered ? 'hover:bg-white/10' : '',
              )}
            >
              {word}
            </span>
          );
        })}
      </div>
      {!answered && (
        <button
          data-testid="quiz-submit-btn"
          onClick={() => onAnswer(selected)}
          className="w-full py-3 px-6 rounded-xl font-semibold bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:bg-purple-600/40 transition-all"
        >
          {t('quiz.submit')}
        </button>
      )}
      {answered && feedback && (
        <FeedbackBox
          correct={feedback.correct}
          explanation={null}
          redFlags={feedback.red_flags_in_text}
          correctLabel={t('quiz.feedback_correct')}
          incorrectLabel={t('quiz.feedback_incorrect')}
        />
      )}
    </div>
  );
});

const CeFaciDacaQuestion = React.memo(function CeFaciDacaQuestion({ question, onAnswer, answered, feedback }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);

  function toggleOption(text) {
    if (answered) return;
    setSelected((prev) =>
      prev.includes(text) ? prev.filter((t) => t !== text) : [...prev, text],
    );
  }

  const correctOptions = feedback?.correct_options || [];

  return (
    <div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 text-white/90 text-sm leading-relaxed">
        {question.scenario}
      </div>
      <p className="text-white/60 text-sm mb-3">{t('quiz.choose_correct')}</p>
      <div className="space-y-2 mb-4">
        {question.options.map((opt, i) => {
          const isSelected = selected.includes(opt.text);
          const isCorrect = answered && correctOptions.includes(opt.text);
          const isWrong = answered && isSelected && !isCorrect;
          const label = String.fromCharCode(65 + i); // A, B, C, D
          return (
            <button
              key={i}
              data-testid={`quiz-option-${i}`}
              disabled={answered}
              onClick={() => toggleOption(opt.text)}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={opt.text}
              className={cn(
                'w-full text-left py-3 px-4 rounded-xl border transition-all flex gap-3 items-start',
                answered ? 'cursor-default' : 'hover:border-purple-500/50',
                !answered && isSelected ? 'bg-purple-500/20 border-purple-500/50 text-white' : '',
                !answered && !isSelected ? 'bg-white/5 border-white/10 text-white/80' : '',
                isCorrect ? 'bg-green-500/15 border-green-500/40 text-green-300' : '',
                isWrong ? 'bg-red-500/15 border-red-500/40 text-red-300' : '',
                answered && !isSelected && !isCorrect ? 'bg-white/5 border-white/10 text-white/40' : '',
              )}
            >
              <span className="font-bold shrink-0 w-5">{label}.</span>
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>
      {!answered && (
        <button
          data-testid="quiz-submit-btn"
          onClick={() => onAnswer(selected)}
          disabled={selected.length === 0}
          className="w-full py-3 px-6 rounded-xl font-semibold bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:bg-purple-600/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('quiz.submit')}
        </button>
      )}
      {answered && feedback && (
        <FeedbackBox
          correct={feedback.correct}
          explanation={feedback.explanation}
          redFlags={null}
          correctLabel={t('quiz.feedback_correct')}
          incorrectLabel={t('quiz.feedback_incorrect')}
        />
      )}
    </div>
  );
});

// ─── score summary ────────────────────────────────────────────────────────────

function ScoreSummary({ score, total, onRetry }) {
  const { t } = useTranslation();
  const pct = Math.round((score / total) * 100);

  function handleShare() {
    const text = t('quiz.share_text')
      .replace('{score}', score)
      .replace('{total}', total);
    const url = 'https://ai-grija.ro/#/quiz';
    if (navigator.share) {
      navigator.share({ title: t('quiz.title'), text, url }).catch(() => {});
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
        '_blank',
        'noopener',
      );
    }
  }

  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚';

  return (
    <div
      className="text-center py-8"
      data-testid="quiz-score-summary"
    >
      <div className="text-6xl mb-4">{emoji}</div>
      <h2 className="text-2xl font-bold text-white mb-2">{t('quiz.score_title')}</h2>
      <p className="text-white/70 mb-6">
        {t('quiz.score_text').replace('{score}', score).replace('{total}', total)}
      </p>
      <div className="w-32 h-32 mx-auto mb-6 relative">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={pct >= 80 ? '#22c55e' : pct >= 50 ? '#a855f7' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
          {pct}%
        </span>
      </div>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          data-testid="quiz-retry-btn"
          onClick={onRetry}
          className="py-3 px-6 rounded-xl font-semibold bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:bg-purple-600/40 transition-all"
        >
          {t('quiz.retry')}
        </button>
        <button
          data-testid="quiz-share-btn"
          onClick={handleShare}
          className="py-3 px-6 rounded-xl font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"
        >
          {t('quiz.share')}
        </button>
      </div>
    </div>
  );
}

// ─── main Quiz component ──────────────────────────────────────────────────────

export default function Quiz() {
  const { t, lang } = useTranslation();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAbortRef = useRef(null);
  const answerAbortRef = useRef(null);

  const loadQuestions = useCallback(async () => {
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const ctrl = new AbortController();
    loadAbortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswered(false);
    setFeedback(null);
    setScore(0);
    setFinished(false);
    try {
      const res = await fetch(`/api/quiz?lang=${lang}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setQuestions(data.questions);
    } catch (e) {
      setError(t('quiz.error'));
    } finally {
      setLoading(false);
    }
  }, [lang, t]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function handleAnswer(answer) {
    if (answerAbortRef.current) answerAbortRef.current.abort();
    const ctrl = new AbortController();
    answerAbortRef.current = ctrl;
    const q = questions[currentIndex];
    try {
      const res = await fetch('/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, answer }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      setFeedback(data);
      setAnswered(true);
      if (data.correct) setScore((s) => s + 1);
    } catch {
      // graceful degradation — mark as answered without feedback
      setAnswered(true);
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswered(false);
      setFeedback(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/60" data-testid="quiz-loading">
        {t('quiz.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4" data-testid="quiz-error">
        <p className="text-red-400">{error}</p>
        <button
          data-testid="quiz-retry-error-btn"
          onClick={loadQuestions}
          className="py-2 px-6 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-200"
        >
          {t('quiz.retry')}
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <section className="py-12 px-4 max-w-2xl mx-auto" data-testid="quiz-container">
        <h1 className="sr-only">{t('quiz.title')}</h1>
        <ScoreSummary score={score} total={questions.length} onRetry={loadQuestions} />
      </section>
    );
  }

  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <section className="py-12 px-4 max-w-2xl mx-auto" data-testid="quiz-container">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">{t('quiz.title')}</h1>
        <p className="text-white/60 text-sm">{t('quiz.subtitle')}</p>
      </div>

      {/* Progress */}
      <ProgressBar current={currentIndex + 1} total={questions.length} />

      {/* Question card */}
      <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
        {/* Question type badge */}
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-4">
          {q.type === 'real_sau_frauda' && t('quiz.badge_real_sau_frauda')}
          {q.type === 'gaseste_semnalele' && t('quiz.badge_gaseste_semnalele')}
          {q.type === 'ce_faci_daca' && t('quiz.badge_ce_faci_daca')}
        </span>

        {/* Render by type */}
        {q.type === 'real_sau_frauda' && (
          <RealSauFraudaQuestion
            question={q}
            onAnswer={handleAnswer}
            answered={answered}
            feedback={feedback}
          />
        )}
        {q.type === 'gaseste_semnalele' && (
          <GasesteSemnaleleQuestion
            question={q}
            onAnswer={handleAnswer}
            answered={answered}
            feedback={feedback}
          />
        )}
        {q.type === 'ce_faci_daca' && (
          <CeFaciDacaQuestion
            question={q}
            onAnswer={handleAnswer}
            answered={answered}
            feedback={feedback}
          />
        )}

        {/* Next button */}
        {answered && (
          <button
            data-testid="quiz-next-btn"
            onClick={handleNext}
            className="mt-4 w-full py-3 px-6 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all"
          >
            {currentIndex + 1 >= questions.length ? t('quiz.see_result') : t('quiz.next')}
          </button>
        )}
      </div>
    </section>
  );
}
