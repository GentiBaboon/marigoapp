'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

type Locale = 'sq' | 'en' | 'it';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('sq');
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const savedLocale = getCookie('marigo_language') as Locale | undefined;
    if (savedLocale && ['sq', 'en', 'it'].includes(savedLocale)) {
      setLocaleState(savedLocale);
    }
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const module = await import(`@/locales/${locale}.json`);
        setTranslations(module.default);
      } catch (error) {
        console.error(`Could not load translations for ${locale}`, error);
        // Fallback to default 'sq' if loading fails
        if (locale !== 'sq') {
          const module = await import(`@/locales/sq.json`);
          setTranslations(module.default);
        }
      }
    };
    loadTranslations();
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookie('marigo_language', newLocale, 365);
    if (user && firestore) {
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, { language: newLocale }).catch(error => {
        console.error("Failed to update user language preference in Firestore:", error);
      });
    }
  }, [user, firestore]);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let result: any = translations;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) {
        // Fallback to the key itself if not found
        return key;
      }
    }
    return typeof result === 'string' ? result : key;
  }, [translations]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};
