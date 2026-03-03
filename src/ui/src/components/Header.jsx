import React, { useState } from 'react';
import { ShieldCheck, Menu, X, Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from '../i18n/index.jsx';

const CONTENT_NAV = [
  { key: 'amenintari', i18nKey: 'content.threats' },
  { key: 'ghid', i18nKey: 'content.guides' },
  { key: 'educatie', i18nKey: 'content.education' },
  { key: 'povesti', i18nKey: 'content.stories' },
  { key: 'rapoarte', i18nKey: 'content.reports' },
  { key: 'presa', i18nKey: 'content.press' },
];

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const { t, lang, setLang, languages, languageNames } = useTranslation();

  const scrollTo = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Not on the home page — navigate home first, then scroll to section
      window.location.hash = '';
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const navigateTo = (hash) => {
    setIsMobileMenuOpen(false);
    setIsContentOpen(false);
    window.location.hash = hash;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="p-1.5 bg-green-600/20 rounded-lg border border-green-500/30">
              <ShieldCheck className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ai-grija<span className="text-green-500">.ro</span></span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button data-testid="header-nav-verifica" onClick={() => scrollTo('verifica')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('header.nav_verifica')}</button>
            <button data-testid="header-nav-cum-functioneaza" onClick={() => scrollTo('cum-functioneaza')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('header.nav_how_it_works')}</button>
            <button data-testid="header-nav-alerte" onClick={() => scrollTo('alerte')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('header.nav_alerte')}</button>

            {/* Primary content nav items */}
            <button data-testid="header-nav-amenintari" onClick={() => navigateTo('/amenintari')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('content.threats')}</button>
            <button data-testid="header-nav-ghid" onClick={() => navigateTo('/ghid')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('content.guides')}</button>
            <button data-testid="header-nav-educatie" onClick={() => navigateTo('/educatie')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t('content.education')}</button>

            {/* More dropdown for remaining 3 categories */}
            <div className="relative">
              <button
                data-testid="header-nav-more-btn"
                onClick={() => setIsContentOpen(!isContentOpen)}
                className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Mai mult
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isContentOpen ? 'rotate-180' : ''}`} />
              </button>
              {isContentOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 glass-card border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                  {[{ key: 'povesti', i18nKey: 'content.stories' }, { key: 'rapoarte', i18nKey: 'content.reports' }, { key: 'presa', i18nKey: 'content.press' }].map(({ key, i18nKey }) => (
                    <button
                      key={key}
                      data-testid={`header-nav-${key}`}
                      onClick={() => navigateTo(`/${key}`)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {t(i18nKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="relative">
              <button
                data-testid="header-lang-switcher"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-white/10"
                aria-label={t('lang_switcher.label')}
              >
                <Globe className="w-4 h-4" />
                <span>{languages[lang]}</span>
              </button>
              {isLangOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 glass-card border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                  {Object.entries(languages).map(([code]) => (
                    <button
                      key={code}
                      data-testid={`lang-option-${code}`}
                      onClick={() => { setLang(code); setIsLangOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${lang === code ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                    >
                      <span className="font-mono font-bold text-xs">{languages[code]}</span>
                      <span>{languageNames[code]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile lang switcher */}
            <div className="relative">
              <button
                data-testid="header-lang-switcher-mobile"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="text-gray-300 hover:text-white p-3 min-h-[44px] flex items-center gap-1"
                aria-label={t('lang_switcher.label')}
              >
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold">{languages[lang]}</span>
              </button>
              {isLangOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 glass-card border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                  {Object.entries(languages).map(([code]) => (
                    <button
                      key={code}
                      data-testid={`lang-option-mobile-${code}`}
                      onClick={() => { setLang(code); setIsLangOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${lang === code ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                    >
                      <span className="font-mono font-bold text-xs">{languages[code]}</span>
                      <span>{languageNames[code]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              data-testid="header-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-300 hover:text-white p-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t('header.menu_aria')}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      <div className={`md:hidden absolute top-16 left-0 right-0 glass-panel transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100 visible border-b border-white/10' : 'opacity-0 invisible h-0 overflow-hidden'}`}>
        <div className="px-4 pt-2 pb-6 space-y-2 flex flex-col bg-[#0A0A0F]/95">
          <button data-testid="header-mobile-verifica" onClick={() => scrollTo('verifica')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">{t('header.mobile_verifica')}</button>
          <button data-testid="header-mobile-cum-functioneaza" onClick={() => scrollTo('cum-functioneaza')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">{t('header.mobile_how_it_works')}</button>
          <button data-testid="header-mobile-alerte" onClick={() => scrollTo('alerte')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">{t('header.mobile_alerte')}</button>
          <div className="border-t border-white/10 pt-2 mt-1">
            {CONTENT_NAV.map(({ key, i18nKey }) => (
              <button
                key={key}
                data-testid={`header-mobile-${key}`}
                onClick={() => navigateTo(`/${key}`)}
                className="w-full text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2"
              >
                {t(i18nKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
