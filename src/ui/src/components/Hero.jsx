import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { fetchCounter } from '../utils/api';
import { useTranslation } from '../i18n/index.jsx';

export default function Hero() {
  const [count, setCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const { t, lang } = useTranslation();

  useEffect(() => {
    const getCount = async () => {
      const data = await fetchCounter();
      if (data && data.count) {
        setTargetCount(data.count);
      }
    };
    getCount();
  }, []);

  useEffect(() => {
    if (targetCount === 0) return;
    
    let start = 0;
    const duration = 2000;
    const increment = targetCount / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= targetCount) {
        setCount(targetCount);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [targetCount]);

  const scrollToChecker = () => {
    document.getElementById('verifica').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-float pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-purple-600/20 rounded-full blur-[120px] animate-float-delayed pointer-events-none"></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card mb-8 animate-fade-in">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium text-gray-300">
            {count > 0 ? t('hero.counter_done', { count: count.toLocaleString(lang === 'ro' ? 'ro-RO' : undefined) }) : t('hero.counter_loading')}
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          <span className="text-white">{t('hero.title_main')}</span>
          <span className="text-gradient from-blue-400 via-purple-400 to-blue-400 animate-shimmer">
            {t('hero.title_highlight')}
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={scrollToChecker}
            data-testid="hero-cta-btn" className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl text-white font-semibold text-lg hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {t('hero.cta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="mt-16 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse-glow rounded-full"></div>
            <Shield className="w-16 h-16 text-blue-500/80 relative z-10" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </section>
  );
}
