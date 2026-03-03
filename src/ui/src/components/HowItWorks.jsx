import React from 'react';
import { ClipboardPaste, Brain, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n/index.jsx';

export default function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: ClipboardPaste,
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/20',
      glow: 'shadow-[0_0_20px_rgba(22,163,74,0.2)]',
      titleKey: 'how_it_works.step1_title',
      descKey: 'how_it_works.step1_desc',
    },
    {
      icon: Brain,
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/20',
      glow: 'shadow-[0_0_20px_rgba(22,163,74,0.2)]',
      titleKey: 'how_it_works.step2_title',
      descKey: 'how_it_works.step2_desc',
    },
    {
      icon: CheckCircle,
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/20',
      glow: 'shadow-[0_0_20px_rgba(22,163,74,0.2)]',
      titleKey: 'how_it_works.step3_title',
      descKey: 'how_it_works.step3_desc',
    }
  ];

  return (
    <section id="cum-functioneaza" className="py-24 relative z-10 border-t border-white/5 bg-gradient-to-b from-[#0A0A0F] to-[#0f0f16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 inline-block relative">
            {t('how_it_works.title')}
            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>
          </h2>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500/10 via-green-500/30 to-green-500/10 -translate-y-1/2 z-0"></div>

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, idx) => (
              <div key={idx} className="glass-card p-8 flex flex-col items-center text-center transform hover:-translate-y-2 transition-transform duration-300">
                <div className={`w-16 h-16 rounded-2xl ${step.bgColor} ${step.glow} flex items-center justify-center mb-6 border border-white/10 rotate-3`}>
                  <step.icon className={`w-8 h-8 ${step.iconColor} -rotate-3`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{t(step.titleKey)}</h3>
                <p className="text-gray-400 leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
