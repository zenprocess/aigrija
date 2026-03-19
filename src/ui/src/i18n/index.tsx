import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ro from './ro.json';
import bg from './bg.json';
import hu from './hu.json';
import uk from './uk.json';
import en from './en.json';

export const LANGUAGES: Record<string, string> = {
  ro: 'RO',
  bg: 'BG',
  hu: 'HU',
  uk: 'UK',
  en: 'EN',
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  ro: '\u{1F1F7}\u{1F1F4}',
  bg: '\u{1F1E7}\u{1F1EC}',
  hu: '\u{1F1ED}\u{1F1FA}',
  uk: '\u{1F1FA}\u{1F1E6}',
  en: '\u{1F1EC}\u{1F1E7}',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  ro: 'Română',
  bg: 'Български',
  hu: 'Magyar',
  uk: 'Українська',
  en: 'English',
};

type Translations = Record<string, unknown>;
const TRANSLATIONS: Record<string, Translations> = { ro, bg, hu, uk, en };
const LS_KEY = 'aigrija_lang';
const SUPPORTED = Object.keys(LANGUAGES);

export interface TranslationContext {
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: string;
  language?: string;
  setLang: (lang: string) => void;
  languages: Record<string, string>;
  languageNames: Record<string, string>;
  languageFlags: Record<string, string>;
}

function detectLanguage(): string {
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get('lang');
  if (queryLang && SUPPORTED.includes(queryLang)) return queryLang;

  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (_) {}

  const browserLang = (navigator.language || '').split('-')[0].toLowerCase();
  if (SUPPORTED.includes(browserLang)) return browserLang;

  return 'ro';
}

function getNestedValue(obj: Translations, key: string): string | null {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

const LanguageContext = createContext<TranslationContext | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(detectLanguage);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang && SUPPORTED.includes(queryLang)) {
      setLangState(queryLang);
    }
  }, []);

  const setLang = useCallback((newLang: string) => {
    if (!SUPPORTED.includes(newLang)) return;
    setLangState(newLang);
    try { localStorage.setItem(LS_KEY, newLang); } catch (_) {}
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const translations = TRANSLATIONS[lang] || TRANSLATIONS['ro'];
    let value = getNestedValue(translations, key);
    if (value == null) {
      value = getNestedValue(TRANSLATIONS['ro'], key);
    }
    if (value == null) return key;
    if (vars) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`));
    }
    return value;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ t, lang, language: lang, setLang, languages: LANGUAGES, languageNames: LANGUAGE_NAMES, languageFlags: LANGUAGE_FLAGS }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): TranslationContext {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
