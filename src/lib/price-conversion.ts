/**
 * Converting between the currency a price is *typed* in and the EUR it is
 * *stored* in.
 *
 * Every persisted price on this platform is EUR — the product document, the
 * order total, the commission split, the Stripe amount and every payout. The
 * display currency defaults to Albanian lek because that is the primary
 * market, so a seller pricing an item thinks in lek and types lek. Those two
 * facts have to meet somewhere, and this module is that place.
 *
 * **The failure mode is a factor of 93.** A lek figure written straight into a
 * EUR field turns a 2.500 ALL dress into a €2,500 one. That is not
 * hypothetical: `src/lib/offers.ts` documents the same bug in the offer sheet,
 * where a number typed beside a "3.092 ALL" preset was stored unconverted.
 * Route every price input through `resolveEurFromInput()` rather than
 * dividing by a rate at the call site.
 */
import type { Currency } from '@/context/CurrencyContext';

/**
 * The rates the app actually runs on.
 *
 * `config/exchangeRates` does not exist in Firestore, so this table — not the
 * document — is what every conversion uses in practice. `ALL` must stay in
 * step with `ALL_PER_EUR` in `src/lib/types.ts`, which the delivery fees are
 * derived from, and with the fallback inside `CurrencyContext.formatPrice`.
 */
export const FALLBACK_RATES: Record<Currency, number> = { EUR: 1, ALL: 93, USD: 1.08 };

/** Resolve the live rate for a currency, falling back to the table above. */
export function rateFor(currency: Currency, rates?: Partial<Record<Currency, number>> | null): number {
  const live = rates?.[currency];
  if (typeof live === 'number' && Number.isFinite(live) && live > 0) return live;
  return FALLBACK_RATES[currency] ?? 1;
}

/** Whole lek, but real decimals for EUR/USD — nobody quotes 0.5 lekë. */
export function roundForCurrency(amount: number, currency: Currency): number {
  return currency === 'ALL' ? Math.round(amount) : Math.round(amount * 100) / 100;
}

/** EUR → the display currency, rounded the way that currency is written. */
export function fromEur(eur: number, currency: Currency, rate: number): number {
  return roundForCurrency(eur * rate, currency);
}

/** Display currency → EUR. Never rounded: EUR is the stored precision. */
export function toEur(amount: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return amount;
  return amount / rate;
}

/**
 * Seed a price input from a stored EUR value.
 *
 * Returns '' for an absent price, so a draft with no price shows an empty box
 * rather than `0` — which a seller would reasonably read as "free".
 */
export function eurToInputValue(
  eur: number | null | undefined,
  currency: Currency,
  rate: number,
): string {
  if (eur === null || eur === undefined || !Number.isFinite(eur)) return '';
  return String(fromEur(eur, currency, rate));
}

/**
 * The value to store, given what the user typed.
 *
 * Returns `undefined` for an empty or unparseable input so the caller can drop
 * the key entirely (see `omitUndefined`) rather than write a `0` price.
 *
 * **The `storedEur` argument exists to stop a silent drift.** €21.25 displays
 * as 1.976 ALL, and 1976 / 93 is €21.247…, so a seller who opened the form and
 * saved without touching the price would shave a fraction off it — every time,
 * compounding on each edit. When the typed figure still matches what the
 * stored price renders as, the stored price is returned untouched.
 */
export function resolveEurFromInput(
  raw: string,
  currency: Currency,
  rate: number,
  storedEur?: number | null,
): number | undefined {
  const typed = parseFloat(raw);
  if (!Number.isFinite(typed)) return undefined;

  if (
    storedEur !== null &&
    storedEur !== undefined &&
    Number.isFinite(storedEur) &&
    fromEur(storedEur, currency, rate) === roundForCurrency(typed, currency)
  ) {
    return storedEur;
  }

  return toEur(typed, rate);
}

/** Suffix shown inside a price input. */
export function currencySuffix(currency: Currency): string {
  return currency === 'ALL' ? 'ALL' : currency === 'USD' ? '$' : '€';
}
