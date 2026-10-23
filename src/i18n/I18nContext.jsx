import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { en } from './en';
import { hi } from './hi';

const LANG_STORAGE_KEY = 'annasetu_pds_lang';

const dictionaries = { en, hi };

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved === 'en' || saved === 'hi') {
          return saved;
        }
      } catch (e) {
        console.warn('Failed to read language preference:', e);
      }
    }
    return 'en';
  });

  const setLanguage = useCallback((lang) => {
    if (lang !== 'en' && lang !== 'hi') return;
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  }, [language, setLanguage]);

  // Translation helper function
  const t = useCallback((path, params = {}) => {
    const dict = dictionaries[language] || dictionaries.en;
    const fallbackDict = dictionaries.en;

    const parts = path.split('.');
    let val = dict;
    for (const p of parts) {
      if (val && typeof val === 'object' && p in val) {
        val = val[p];
      } else {
        val = undefined;
        break;
      }
    }

    // Fallback to English if missing in target
    if (val === undefined) {
      let fb = fallbackDict;
      for (const p of parts) {
        if (fb && typeof fb === 'object' && p in fb) {
          fb = fb[p];
        } else {
          fb = undefined;
          break;
        }
      }
      val = fb !== undefined ? fb : path;
    }

    if (typeof val === 'string' && params && typeof params === 'object') {
      let result = val;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
      return result;
    }

    return val;
  }, [language]);

  // Direct commodity translation helper
  const tCommodity = useCallback((commName) => {
    if (!commName) return '';
    const dict = dictionaries[language] || dictionaries.en;
    return dict?.commodities?.[commName] || commName;
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t,
    tCommodity,
    isHindi: language === 'hi',
  }), [language, setLanguage, toggleLanguage, t, tCommodity]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
