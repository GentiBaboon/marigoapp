/**
 * @fileOverview Constants and pure helpers shared by the whole app — with
 * **no zod and no schemas**.
 *
 * Split out of `types.ts` on 2026-09-11. That module defines every Zod
 * schema at import time, so any file that needed one constant from it —
 * the cart context for the delivery fee, the header for `toDate()`, a
 * product card for the seller badge — pulled zod (57 KB) and every schema
 * into the first load of every page and evaluated them during hydration.
 * `types.ts` re-exports everything here, so existing imports still work;
 * first-paint code should import from this module directly.
 *
 * Keep this file free of runtime imports other than `firebase/firestore`
 * types; a test checks it never imports zod or `./types` as a value.
 */

import type { Timestamp, FieldValue } from 'firebase/firestore';
import type { BadgeSettings, FirestoreUser, SellerBadge, RelatedProductsConfig } from './types';

// --- Timestamps ---
export type FirestoreTimestamp = Timestamp | FieldValue | { seconds: number; nanoseconds: number };

/**
 * Safely convert a FirestoreTimestamp to a JS Date.
 * Handles Timestamp objects, raw {seconds, nanoseconds}, and ISO strings.
 */
export function toDate(ts: FirestoreTimestamp | string | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof (ts as any).toDate === 'function') return (ts as any).toDate();
  if (typeof (ts as any).seconds === 'number') return new Date((ts as any).seconds * 1000);
  return null;
}

// --- Seller badges ---
export const DEFAULT_BADGE_SETTINGS: BadgeSettings = {
  trustedMinSales: 0,
  expertMinSales: 5,
  activistMinSales: 10,
  labels: {
    trusted: 'Trusted Seller',
    expert: 'Expert Seller',
    activist: 'Fashion Activist',
    official: 'Official Registered Brand',
  },
  variantsEnabled: {
    trusted: false,
    expert: false,
    activist: false,
    official: true,
  },
};

// Resolve the effective settings, merging stored values onto the defaults so
// callers always receive a complete object regardless of partial saves.
export function resolveBadgeSettings(stored?: Partial<BadgeSettings> | null): BadgeSettings {
  return {
    trustedMinSales: stored?.trustedMinSales ?? DEFAULT_BADGE_SETTINGS.trustedMinSales,
    expertMinSales: stored?.expertMinSales ?? DEFAULT_BADGE_SETTINGS.expertMinSales,
    activistMinSales: stored?.activistMinSales ?? DEFAULT_BADGE_SETTINGS.activistMinSales,
    labels: { ...DEFAULT_BADGE_SETTINGS.labels, ...(stored?.labels ?? {}) },
    variantsEnabled: { ...DEFAULT_BADGE_SETTINGS.variantsEnabled, ...(stored?.variantsEnabled ?? {}) },
  };
}

export function getSellerLevel(
  user: Partial<FirestoreUser> | null | undefined,
  settings?: Partial<BadgeSettings> | null,
): SellerBadge | null {
  const s = resolveBadgeSettings(settings);

  // 1. Explicit admin override wins — bypasses thresholds entirely.
  if (user?.badgeOverride) {
    return { level: user.badgeOverride, label: s.labels[user.badgeOverride] };
  }
  // 2. Official-brand flag remains a shortcut to the top-tier badge.
  if (user?.isOfficialBrand) return { level: 'official', label: s.labels.official };
  // 3. Otherwise compute from sales count + configurable thresholds.
  const sales = typeof user?.salesCount === 'number' ? user.salesCount : 0;
  if (sales >= s.activistMinSales) return { level: 'activist', label: s.labels.activist };
  if (sales >= s.expertMinSales) return { level: 'expert', label: s.labels.expert };
  if (sales >= s.trustedMinSales) return { level: 'trusted', label: s.labels.trusted };
  // Below the Trusted threshold → no badge.
  return null;
}


// --- Money ---
export const DEFAULT_PAYOUT_HOLD_HOURS = 72;
export const DEFAULT_REFUND_WINDOW_DAYS = 14;
export const DEFAULT_COMMISSION_RATE = 0.15;

/**
 * Flat delivery fee charged on an order.
 *
 * The business figure is a round **200 ALL** — Albania is the primary market
 * and `DEFAULT_CURRENCY` is ALL. It is stored in EUR because every persisted
 * money value in the app is (Stripe amounts, payouts, the finance dashboards),
 * and `formatPrice()` converts for display.
 *
 * `ALL_PER_EUR` mirrors the fallback table in `CurrencyContext` — which is the
 * rate the app actually runs on today, since `config/exchangeRates` does not
 * exist in Firestore. Dividing here rather than hardcoding 1.93 keeps the
 * displayed figure exactly 200 ALL, and makes the intent legible if the rate
 * ever moves. If a real `config/exchangeRates` doc is added with a different
 * ALL rate, the *displayed* fee drifts off 200 — update this pair together.
 *
 * Replaces the two separate hardcoded `10.9` literals that used to live in
 * CartContext and the create-order route, which could silently disagree.
 */
export const DEFAULT_SHIPPING_FEE_ALL = 200;
/**
 * Crossing the Albania–Kosovo border costs more than a domestic run, so a
 * parcel whose origin country differs from the delivery country is charged at
 * this rate instead. Still per origin city: two Kosovan cities delivering into
 * Albania are two crossings, not one.
 */
export const CROSS_BORDER_SHIPPING_FEE_ALL = 500;
const ALL_PER_EUR = 93;
export const DEFAULT_SHIPPING_FEE_EUR = DEFAULT_SHIPPING_FEE_ALL / ALL_PER_EUR;
export const CROSS_BORDER_SHIPPING_FEE_EUR = CROSS_BORDER_SHIPPING_FEE_ALL / ALL_PER_EUR;


export const DEFAULT_RELATED_PRODUCTS_CONFIG: RelatedProductsConfig = {
  enabled: true,
  count: 8,
  matchBy: 'subcategory',
  sameGender: true,
  sortBy: 'newest',
};

/** Human label for a dispute's `source` tag. Used on chat headers and on
 *  the admin disputes board so all three audiences see the same wording. */
export function disputeKindLabel(source?: string): string {
  switch (source) {
    case 'buyer_cancel_request':
      return 'Cancellation request';
    case 'seller_cancel_request':
      return 'Cancellation request (seller)';
    case 'buyer_refund_request':
      return 'Refund request';
    default:
      return 'Dispute';
  }
}
