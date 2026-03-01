import React from "react";
import { useTranslation } from '../i18n/index.jsx';

export default function About() {
  const { t } = useTranslation();

  return (
    <section id="despre" className="py-20 relative z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold text-white mb-6">{t('about.title')}</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            {t('about.p1')}
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            {t('about.p2')}
          </p>
        </div>
      </div>
    </section>
  );
}
