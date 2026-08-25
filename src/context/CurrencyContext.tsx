
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getCookie, setCookie } from '@/lib/cookies';

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

/**
 * What a visitor sees before they have chosen anything.
 *
 * Albanian lek, because the primary market is Albania. This is a *display*
 * default only — every price is still stored in EUR on the product document
 * and converted through `config/exchangeRates` by `formatPrice`, so changing
 * this does not touch stored data, payouts or Stripe amounts.
 */
export const DEFAULT_CURRENCY: Currency = 'ALL';

/**
 * The currencies a shopper can actually pick.
 *
 * `Currency` still includes USD so the conversion path stays intact — it is
 * only withheld from the picker until it is finished. Restoring it means
 * adding it back here and re-adding the row in `user-nav.tsx`.
 *
 * This list is also what a saved preference is validated against, so anyone
 * who selected USD while it was offered lands back on the default instead of
 * being stranded on prices in a currency no control can change.
 */
const SELECTABLE_CURRENCIES: Currency[] = ['EUR', 'ALL'];

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
    const { user } = useUser();
    const firestore = useFirestore();

    const ratesRef = useMemoFirebase(() => firestore ? doc(firestore, 'config', 'exchangeRates') : null, [firestore]);
    const { data: exchangeRates, isLoading } = useDoc<ExchangeRates>(ratesRef);

    useEffect(() => {
        const savedCurrency = getCookie('marigo_currency') as Currency | undefined;
        if (savedCurrency && SELECTABLE_CURRENCIES.includes(savedCurrency)) {
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
        // Fallback table. `config/exchangeRates` does not exist in Firestore,
        // so in practice this IS the rate the app runs on. Keep ALL in step
        // with ALL_PER_EUR in src/lib/types.ts, which derives the shipping fee.
        const rates = exchangeRates?.rates || { EUR: 1, ALL: 93, USD: 1.08 };
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
            maximumFractionDigits: 2
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
