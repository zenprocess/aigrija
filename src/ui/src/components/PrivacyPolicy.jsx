import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n/index.js';

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <button
          data-testid="privacy-back-btn"
          onClick={() => { window.location.hash = ''; }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('privacy.back')}
        </button>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold text-white">{t('privacy.title')}</h1>
          </div>

          <p className="text-gray-400 text-sm">{t('privacy.last_updated')}</p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s1_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s1_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s2_title')}</h2>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 space-y-2">
              <p className="text-green-400 font-semibold">{t('privacy.s2_highlight')}</p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside text-sm">
                <li>{t('privacy.s2_li1')}</li>
                <li>{t('privacy.s2_li2')}</li>
                <li>{t('privacy.s2_li3')}</li>
                <li>{t('privacy.s2_li4')}</li>
                <li>{t('privacy.s2_li5')}</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s3_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s3_body')}</p>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>{t('privacy.s3_li1')}</li>
              <li>{t('privacy.s3_li2')}</li>
              <li>{t('privacy.s3_li3')}</li>
              <li>{t('privacy.s3_li4')}</li>
              <li>{t('privacy.s3_li5')}</li>
            </ul>
            <p className="text-gray-400 text-sm">{t('privacy.s3_note')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s4_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s4_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s5_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s5_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s6_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s6_body')}</p>
            <a
              data-testid="privacy-contact-link"
              href="mailto:privacy@ai-grija.ro"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              privacy@ai-grija.ro
            </a>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('privacy.s7_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('privacy.s7_body')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
