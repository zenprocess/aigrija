import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n/index.jsx';

export default function TermsOfService() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <button
          data-testid="terms-back-btn"
          onClick={() => { window.location.hash = ''; }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('terms.back')}
        </button>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <FileText className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold text-white">{t('terms.title')}</h1>
          </div>

          <p className="text-gray-400 text-sm">{t('terms.last_updated')}</p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s1_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s1_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s2_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s2_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s3_title')}</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <p className="text-yellow-300 font-semibold mb-2">{t('terms.s3_highlight')}</p>
              <p className="text-gray-300 text-sm leading-relaxed">{t('terms.s3_body')}</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s4_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s4_intro')}</p>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>{t('terms.s4_li1')}</li>
              <li>{t('terms.s4_li2')}</li>
              <li>{t('terms.s4_li3')}</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s5_title')}</h2>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>{t('terms.s5_li1')}</li>
              <li>{t('terms.s5_li2')}</li>
              <li>{t('terms.s5_li3')}</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s6_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s6_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s7_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s7_body')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{t('terms.s8_title')}</h2>
            <p className="text-gray-300 leading-relaxed">{t('terms.s8_body')}</p>
            <a
              data-testid="terms-contact-link"
              href="mailto:contact@ai-grija.ro"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              contact@ai-grija.ro
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
