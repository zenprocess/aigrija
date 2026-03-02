import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Github, Heart, MessageSquare } from 'lucide-react';
import { useTranslation } from '../i18n/index.jsx';

function TranslationReportModal({ open, onClose }) {
  const { t, language } = useTranslation();
  const [currentText, setCurrentText] = useState('');
  const [suggestedText, setSuggestedText] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const dialogRef = useRef(null);
  const submitAbortRef = useRef(null);

  const page = typeof window !== 'undefined' ? window.location.hash || '/' : '/';

  // Open/close the native dialog in sync with the `open` prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  // Forward the native ESC-key cancel event to onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleCancel(e) {
      e.preventDefault();
      onClose();
    }
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Close when clicking outside the dialog panel (on the ::backdrop area)
  function handleBackdropClick(e) {
    if (e.target === dialogRef.current) onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    if (submitAbortRef.current) submitAbortRef.current.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setStatus('loading');
    try {
      const res = await fetch('/api/translation-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          lang: language || 'ro',
          currentText: currentText.trim() || undefined,
          suggestedText: suggestedText.trim() || undefined,
          comment: comment.trim(),
          page,
        }),
      });
      if (res.ok) {
        setStatus('success');
        setTimeout(onClose, 2500);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <style>{`
        dialog[data-testid="translation-report-dialog"]::backdrop {
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(2px);
        }
        dialog[data-testid="translation-report-dialog"] {
          padding: 0;
          border: none;
          background: transparent;
        }
      `}</style>
      <dialog
        ref={dialogRef}
        data-testid="translation-report-dialog"
        aria-labelledby="translation-report-title"
        onClick={handleBackdropClick}
        style={{ margin: 'auto' }}
      >
        <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 id="translation-report-title" className="text-white font-semibold text-base">
              {t('translation_report.title')}
            </h2>
            <button
              data-testid="translation-report-close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Inchide"
            >
              &times;
            </button>
          </div>

          {status === 'success' ? (
            <p className="text-green-400 text-sm text-center py-4">{t('translation_report.success')}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('translation_report.current_text')}
                </label>
                <input
                  data-testid="translation-report-current-text"
                  type="text"
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-base text-gray-200 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Textul afișat acum..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('translation_report.suggested')}
                </label>
                <input
                  data-testid="translation-report-suggested"
                  type="text"
                  value={suggestedText}
                  onChange={(e) => setSuggestedText(e.target.value)}
                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-base text-gray-200 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cum ar trebui să fie..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('translation_report.comment')} <span className="text-red-400">*</span>
                </label>
                <textarea
                  data-testid="translation-report-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  rows={3}
                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-base text-gray-200 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Descrie problema..."
                />
              </div>
              {status === 'error' && (
                <p className="text-red-400 text-xs">{t('translation_report.error')}</p>
              )}
              <button
                data-testid="translation-report-submit"
                type="submit"
                disabled={status === 'loading' || !comment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors min-h-[44px]"
              >
                {status === 'loading' ? '...' : t('translation_report.submit')}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

export default function Footer() {
  const { t } = useTranslation();
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  return (
    <footer className="bg-black/80 border-t border-white/10 pt-12 pb-8 relative z-10" style={{paddingBottom: "max(2rem, env(safe-area-inset-bottom))"}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">ai-grija<span className="text-blue-500">.ro</span></span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-400">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('footer.section_content')}</span>
              <a data-testid="footer-link-amenintari" href="#/amenintari" className="hover:text-white transition-colors">{t('content.threats')}</a>
              <a data-testid="footer-link-ghid" href="#/ghid" className="hover:text-white transition-colors">{t('content.guides')}</a>
              <a data-testid="footer-link-educatie" href="#/educatie" className="hover:text-white transition-colors">{t('content.education')}</a>
              <a data-testid="footer-link-povesti" href="#/povesti" className="hover:text-white transition-colors">{t('content.stories')}</a>
              <a data-testid="footer-link-rapoarte" href="#/rapoarte" className="hover:text-white transition-colors">{t('content.reports')}</a>
              <a data-testid="footer-link-presa" href="#/presa" className="hover:text-white transition-colors">{t('content.press')}</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('footer.section_legal')}</span>
              <a data-testid="footer-link-confidentialitate" href="#/confidentialitate" className="hover:text-white transition-colors">{t('footer.privacy')}</a>
              <a data-testid="footer-link-termeni" href="#/termeni" className="hover:text-white transition-colors">{t('footer.terms')}</a>
              <a data-testid="footer-link-despre" href="#despre" className="hover:text-white transition-colors">{t('footer.about')}</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>

          <div className="flex items-center gap-1">
            <span>{t('footer.made_with')}</span>
            <Heart className="w-4 h-4 text-red-500 mx-1" />
            <span>{t('footer.made_by')}</span>
            <a data-testid="footer-link-zenlabs" href="https://zen-labs.ro" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors font-medium ml-1">Zen Labs</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              data-testid="report-translation-btn"
              onClick={() => setShowTranslationModal(true)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              {t('footer.report_translation')}
            </button>

            <a data-testid="footer-link-github" href="https://github.com/zenprocess/aigrija" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
              <Github className="w-4 h-4" />
              <span>{t('footer.github')}</span>
            </a>
          </div>
        </div>
      </div>

      <TranslationReportModal
        open={showTranslationModal}
        onClose={() => setShowTranslationModal(false)}
      />
    </footer>
  );
}
