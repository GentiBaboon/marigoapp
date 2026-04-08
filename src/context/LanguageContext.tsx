'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getCookie, setCookie } from '@/lib/cookies';

import en from '@/lib/translations/en.json';
import sq from '@/lib/translations/sq.json';
import it from '@/lib/translations/it.json';

export type Locale = 'en' | 'sq' | 'it';

const translations = { en, sq, it };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Set default language to English
  const [locale, setLocaleState] = useState<Locale>('en');
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const savedLocale = getCookie('marigo_locale') as Locale | undefined;
    if (savedLocale && ['en', 'sq', 'it'].includes(savedLocale)) {
      setLocaleState(savedLocale);
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (['en', 'sq', 'it'].includes(browserLang)) {
        setLocaleState(browserLang as Locale);
      }
    }
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookie('marigo_locale', newLocale, 365);
    if (user && firestore) {
      try {
        await updateDoc(doc(firestore, 'users', user.uid), { language: newLocale });
      } catch (e) {
        console.error("Failed to update user language preference", e);
      }
    }
  }, [user, firestore]);

  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let current: any = translations[locale];
    for (const k of keys) {
      if (!current || current[k] === undefined) return key;
      current = current[k];
    }
    return current;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
