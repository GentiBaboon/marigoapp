
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

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

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('sq');
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
      if (current[k] === undefined) return key;
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
