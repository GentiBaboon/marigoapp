/**
 * @fileOverview How a basket's delivery fee is worked out.
 *
 * One flat fee per **city shipped from**, not per item and not per seller.
 * Two sellers both in Tirana share a single courier run, so the basket pays
 * 200 ALL once. A seller in Tirana plus one in Berat is two runs, so 400 ALL.
 *
 * A run whose origin country differs from the delivery country crosses the
 * Albania–Kosovo border and costs 500 ALL instead of 200. Still per city: two
 * Kosovan cities delivering into Albania are two crossings.
 *
 * Lives here because two places must produce the same number: `CartContext`
 * (what the buyer sees) and `create-order` (what the buyer is actually
 * charged). Those used to be separate hardcoded literals that could silently
 * drift apart.
 *
 * The origin city is denormalised onto the product as `shippingFromCity`.
 * It cannot be looked up at checkout time: a seller's addresses live under
 * `users/{sellerId}/addresses`, which `firestore.rules` makes readable only by
 * that seller. Stamping the city onto the listing at publish keeps the buyer's
 * basket computable without opening up seller address books.
 */

import { CROSS_BORDER_SHIPPING_FEE_EUR, DEFAULT_SHIPPING_FEE_EUR } from '@/lib/types';

/** Anything the fee calculation needs to know about one basket line. */
export interface ShippableLine {
  sellerId: string;
  /** Origin city. Missing on listings published before this was stamped. */
  shippingFromCity?: string | null;
  /** Origin country. Decides the domestic vs cross-border rate. */
  shippingFromCountry?: string | null;
}

/**
 * Listings with no recorded city are pooled under this key rather than each
 * paying a fee. Also stands in for an unknown country, which is what keeps an
 * un-stamped listing off the cross-border rate.
 */
export const UNKNOWN_CITY = 'Unknown';

/**
 * Normalise a place name — used for both cities and countries — so "tirana",
 * "Tirana " and "Tiranë" are not charged as three separate courier runs.
 */
export function normalizeCity(city: string | null | undefined): string {
  const trimmed = (city ?? '').trim();
  if (!trimmed) return UNKNOWN_CITY;
  return trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ShippingGroup {
  /** Normalised key used for grouping. */
  key: string;
  /** The city as it should be shown, taken from the first line that named it. */
  label: string;
  /** Distinct sellers shipping from this city. */
  sellerIds: string[];
  /** Fee for this city, in EUR (the storage currency). */
  feeEur: number;
  /** True when this parcel crosses the border and pays the higher rate. */
  isCrossBorder: boolean;
  /** Origin country as stored, for display. */
  country: string;
}

/**
 * Group basket lines by origin city and price each group.
 *
 * Returns an empty list for an empty basket — no items, no delivery.
 */
export function groupShippingByCity(
  lines: ShippableLine[],
  destinationCountry?: string | null,
): ShippingGroup[] {
  if (lines.length === 0) return [];

  const destination = normalizeCity(destinationCountry);
  const groups = new Map<string, { label: string; country: string; sellerIds: Set<string> }>();

  for (const line of lines) {
    const cityKey = normalizeCity(line.shippingFromCity);
    const countryKey = normalizeCity(line.shippingFromCountry);
    // Keyed on both: the same city name in two countries is two origins, and
    // the rate depends on the country.
    const key = `${countryKey}|${cityKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sellerIds.add(line.sellerId);
      continue;
    }
    groups.set(key, {
      // Show the seller's own spelling; fall back to a neutral label when the
      // listing predates the city being recorded.
      label: (line.shippingFromCity ?? '').trim() || UNKNOWN_CITY,
      country: (line.shippingFromCountry ?? '').trim(),
      sellerIds: new Set([line.sellerId]),
    });
  }

  return [...groups.entries()].map(([key, g]) => {
    const originKey = normalizeCity(g.country);
    // Only charge the border rate when both ends are actually known. An
    // unrecorded origin or a checkout with no address yet must not silently
    // more-than-double the quote.
    const isCrossBorder =
      originKey !== UNKNOWN_CITY &&
      destination !== UNKNOWN_CITY &&
      originKey !== destination;

    return {
      key,
      label: g.label,
      country: g.country,
      sellerIds: [...g.sellerIds],
      isCrossBorder,
      feeEur: isCrossBorder ? CROSS_BORDER_SHIPPING_FEE_EUR : DEFAULT_SHIPPING_FEE_EUR,
    };
  });
}

export function calculateShipping(
  lines: ShippableLine[],
  options: { isFree?: boolean; destinationCountry?: string | null } = {},
): { totalEur: number; groups: ShippingGroup[] } {
  const groups = groupShippingByCity(lines, options.destinationCountry);
  if (options.isFree) {
    return { totalEur: 0, groups: groups.map(g => ({ ...g, feeEur: 0 })) };
  }
  return { totalEur: groups.reduce((sum, g) => sum + g.feeEur, 0), groups };
}
