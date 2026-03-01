import React from 'react';
import { Github, Heart } from 'lucide-react';
import { useTranslation } from '../i18n/index.jsx';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-black/80 border-t border-white/10 pt-12 pb-8 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">ai-grija<span className="text-blue-500">.ro</span></span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-400">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Continut</span>
              <a data-testid="footer-link-amenintari" href="#/amenintari" className="hover:text-white transition-colors">{t('content.threats')}</a>
              <a data-testid="footer-link-ghid" href="#/ghid" className="hover:text-white transition-colors">{t('content.guides')}</a>
              <a data-testid="footer-link-educatie" href="#/educatie" className="hover:text-white transition-colors">{t('content.education')}</a>
              <a data-testid="footer-link-povesti" href="#/povesti" className="hover:text-white transition-colors">{t('content.stories')}</a>
              <a data-testid="footer-link-rapoarte" href="#/rapoarte" className="hover:text-white transition-colors">{t('content.reports')}</a>
              <a data-testid="footer-link-presa" href="#/presa" className="hover:text-white transition-colors">{t('content.press')}</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Legal</span>
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

          <a data-testid="footer-link-github" href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
            <Github className="w-4 h-4" />
            <span>{t('footer.github')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
