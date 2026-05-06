import { createContext, useContext, useState, useCallback } from 'react';
import translations from './translations.json';

// Supported languages
export const LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English',  flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',    nativeLabel: 'हिन्दी',    flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',  nativeLabel: 'ಕನ್ನಡ',    flag: '🏛️' },
];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('nyayasetu-lang') || 'en';
  });

  const switchLanguage = useCallback((code) => {
    setLang(code);
    localStorage.setItem('nyayasetu-lang', code);
  }, []);

  // t(key) — returns translated string, falls back to English, then key itself
  const t = useCallback((key) => {
    const langData = translations[lang] || translations['en'];
    const enData   = translations['en'];
    return langData[key] ?? enData[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, switchLanguage, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
