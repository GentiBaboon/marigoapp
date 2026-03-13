
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export type Currency = 'EUR' | 'ALL' | 'USD';

type ExchangeRates = {
    base: string;
    rates: {
        EUR: number;
        ALL: number;
        USD: number;
    };
    lastUpdated: any;
};

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    formatPrice: (priceInEur: number, targetCurrency?: Currency) => string;
    rates: ExchangeRates['rates'] | null;
    isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

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

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currency, setCurrencyState] = useState<Currency>('EUR');
    const { user } = useUser();
    const firestore = useFirestore();

    const ratesRef = useMemoFirebase(() => firestore ? doc(firestore, 'config', 'exchangeRates') : null, [firestore]);
    const { data: exchangeRates, isLoading } = useDoc<ExchangeRates>(ratesRef);

    useEffect(() => {
        const savedCurrency = getCookie('marigo_currency') as Currency | undefined;
        if (savedCurrency && ['EUR', 'ALL', 'USD'].includes(savedCurrency)) {
            setCurrencyState(savedCurrency);
        }
    }, []);
    
    const setCurrency = useCallback(async (newCurrency: Currency) => {
        setCurrencyState(newCurrency);
        setCookie('marigo_currency', newCurrency, 365);
        if (user && firestore) {
            try {
                await updateDoc(doc(firestore, 'users', user.uid), { currency: newCurrency });
            } catch (e) {
                console.error("Failed to update user currency preference", e);
            }
        }
    }, [user, firestore]);

    const formatPrice = useCallback((priceInEur: number, targetCurrency?: Currency) => {
        const c = targetCurrency || currency;
        const rates = exchangeRates?.rates || { EUR: 1, ALL: 103.5, USD: 1.08 }; // Fallback rates
        const rate = rates[c] || 1;
        const convertedPrice = priceInEur * rate;
        
        let locale = 'de-DE'; // For EUR
        if (c === 'ALL') {
            return `${Math.round(convertedPrice).toLocaleString('de-DE')} ALL`;
        }
        else if (c === 'USD') locale = 'en-US';

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: c,
            maximumFractionDigits: c === 'ALL' ? 0 : 2
        }).format(convertedPrice);

    }, [currency, exchangeRates]);

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, rates: exchangeRates?.rates || null, isLoading }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};
