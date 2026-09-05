import { describe, it, expect } from 'vitest';
import {
  FALLBACK_RATES, rateFor, fromEur, toEur, eurToInputValue,
  resolveEurFromInput, roundForCurrency, currencySuffix,
} from '@/lib/price-conversion';

const ALL = FALLBACK_RATES.ALL; // 93

describe('rateFor', () => {
  it('falls back when config/exchangeRates is absent, which it is', () => {
    expect(rateFor('ALL', null)).toBe(93);
    expect(rateFor('EUR', null)).toBe(1);
  });
  it('prefers a live rate but rejects a nonsense one', () => {
    expect(rateFor('ALL', { ALL: 100 })).toBe(100);
    expect(rateFor('ALL', { ALL: 0 })).toBe(93);
    expect(rateFor('ALL', { ALL: -5 })).toBe(93);
    expect(rateFor('ALL', { ALL: NaN })).toBe(93);
  });
});

describe('conversion', () => {
  it('rounds lek to whole units and EUR to cents', () => {
    expect(roundForCurrency(1976.25, 'ALL')).toBe(1976);
    expect(roundForCurrency(21.2537, 'EUR')).toBe(21.25);
  });
  it('converts EUR to lek for display', () => {
    expect(fromEur(25, 'ALL', ALL)).toBe(2325);
  });
  it('is identity when the display currency is EUR', () => {
    expect(fromEur(25, 'EUR', 1)).toBe(25);
    expect(toEur(25, 1)).toBe(25);
  });
});

describe('resolveEurFromInput — the 93x guard', () => {
  it('stores EUR when lek is typed', () => {
    // The whole point: 2325 typed must not become €2,325.
    expect(resolveEurFromInput('2325', 'ALL', ALL)).toBe(25);
  });

  it('leaves a EUR entry untouched when EUR is the display currency', () => {
    expect(resolveEurFromInput('25', 'EUR', 1)).toBe(25);
  });

  it('does not drift the stored price on a save that did not change it', () => {
    // €21.25 renders as 1976 ALL; 1976/93 is €21.2473, so a plain conversion
    // would shave the price a little on every no-op save, compounding.
    const stored = 21.25;
    expect(fromEur(stored, 'ALL', ALL)).toBe(1976);
    expect(resolveEurFromInput('1976', 'ALL', ALL, stored)).toBe(21.25);
  });

  it('still converts when the figure really was edited', () => {
    expect(resolveEurFromInput('2325', 'ALL', ALL, 21.25)).toBe(25);
  });

  it('returns undefined for an empty or junk input, never 0', () => {
    // undefined lets the caller drop the key; 0 would publish a free item.
    expect(resolveEurFromInput('', 'ALL', ALL)).toBeUndefined();
    expect(resolveEurFromInput('abc', 'ALL', ALL)).toBeUndefined();
  });

  it('accepts a deliberate zero', () => {
    expect(resolveEurFromInput('0', 'ALL', ALL)).toBe(0);
  });
});

describe('eurToInputValue', () => {
  it('seeds the box in the display currency', () => {
    expect(eurToInputValue(25, 'ALL', ALL)).toBe('2325');
    expect(eurToInputValue(25, 'EUR', 1)).toBe('25');
  });
  it('shows an empty box for a draft with no price, not 0', () => {
    expect(eurToInputValue(undefined, 'ALL', ALL)).toBe('');
    expect(eurToInputValue(null, 'ALL', ALL)).toBe('');
  });
  it('round-trips a typed figure unchanged', () => {
    for (const typed of ['500', '2325', '10000', '1']) {
      const eur = resolveEurFromInput(typed, 'ALL', ALL)!;
      expect(eurToInputValue(eur, 'ALL', ALL)).toBe(typed);
    }
  });
});

describe('currencySuffix', () => {
  it('labels the input so the number is never ambiguous', () => {
    expect(currencySuffix('ALL')).toBe('ALL');
    expect(currencySuffix('EUR')).toBe('€');
  });
});
