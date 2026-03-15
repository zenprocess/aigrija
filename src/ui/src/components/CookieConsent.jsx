import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.jsx';

export function getConsentPreferences() {
  try {
    return JSON.parse(localStorage.getItem('cookie_preferences') || '{}');
  } catch {
    return {};
  }
}

export function hasAnalyticsConsent() {
  return getConsentPreferences().analytics === true;
}

function saveConsent(analytics) {
  localStorage.setItem('cookie_preferences', JSON.stringify({ essential: true, analytics }));
  localStorage.setItem('cookie_consent_given', 'true');
}

export default function CookieConsent({ onVisibilityChange }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    const given = localStorage.getItem('cookie_consent_given');
    if (!given) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  function handleAcceptAll() {
    saveConsent(true);
    setVisible(false);
  }

  function handleRejectAll() {
    saveConsent(false);
    setVisible(false);
  }

  function handleSavePreferences() {
    saveConsent(analyticsEnabled);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      data-testid="consent-banner"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 flex justify-center consent-banner-enter"
    >
      <style>{`
        .consent-banner-enter {
          animation: consent-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes consent-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .consent-settings-panel {
          overflow: hidden;
          transition: max-height 0.3s ease, opacity 0.3s ease;
          max-height: 0;
          opacity: 0;
        }
        .consent-settings-panel.open {
          max-height: 300px;
          opacity: 1;
        }
      `}</style>

      <div className="w-full max-w-lg bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {t('consent.banner_text')}{' '}
          <a
            href="#/confidentialitate"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            {t('consent.privacy_link')}
          </a>
        </p>

        <div className={'consent-settings-panel' + (showSettings ? ' open' : '')}>
          <div className="mb-4 space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-200">{t('consent.essential_title')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('consent.essential_desc')}</p>
              </div>
              <div className="mt-0.5 flex-shrink-0 w-10 h-6 rounded-full bg-blue-600 flex items-center justify-end px-1 cursor-not-allowed opacity-60">
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-200">{t('consent.analytics_title')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('consent.analytics_desc')}</p>
              </div>
              <button
                data-testid="consent-analytics-toggle"
                type="button"
                role="switch"
                aria-checked={analyticsEnabled}
                onClick={() => setAnalyticsEnabled((v) => !v)}
                className={'mt-0.5 flex-shrink-0 w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 ' + (analyticsEnabled ? 'bg-blue-600 justify-end' : 'bg-white/20 justify-start')}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow transition-all duration-200" />
              </button>
            </div>
          </div>

          <div className="mb-3">
            <button
              data-testid="consent-save-btn"
              type="button"
              onClick={handleSavePreferences}
              className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors duration-150"
            >
              {t('consent.save')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            data-testid="consent-accept-all"
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 min-w-[120px] py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors duration-150"
          >
            {t('consent.accept_all')}
          </button>
          <button
            data-testid="consent-reject-btn"
            type="button"
            onClick={handleRejectAll}
            className="flex-1 min-w-[100px] py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-sm font-medium transition-colors duration-150 border border-white/10"
          >
            {t('consent.reject_all')}
          </button>
          <button
            data-testid="consent-settings-btn"
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors duration-150 border border-white/10"
          >
            {t('consent.settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
