/**
 * Re-pricing delivery when a seller changes where an order ships from.
 *
 * Delivery is charged per distinct origin city, at the domestic or the
 * cross-border rate depending on whether that city is in the buyer's country
 * (`src/lib/shipping.ts`). The origin is stamped on the *listing* at publish,
 * so until a seller could move it there was nothing to re-price. Now that
 * they can change it on a placed order, the fee the buyer owes can change
 * with it — Tirana to Tirana is 200 ALL, Prishtina to Tirana is 500 — and
 * leaving the stored fee alone would have the courier collect the wrong
 * amount at the door.
 *
 * Pure: the route does the reads and the write, this decides the money. Same
 * `calculateShipping` the cart quotes with and `/api/create-order` charges
 * with, so all three agree by construction.
 */
import { calculateShipping, type ShippableLine, type ShippingGroup } from './shipping';

export interface OriginOverride {
  city: string | null;
  country: string | null;
}

/**
 * Statuses where the origin may still move.
 *
 * Once the parcel is with the courier the run has been priced and driven;
 * changing where it supposedly came from would rewrite history and, on cash
 * on delivery, change what is collected for a journey already made.
 */
export const ORIGIN_EDITABLE_STATUSES: ReadonlySet<string> = new Set([
  'confirmed',
  'processing',
  'in_preparation',
  'prepared',
]);

export function canChangeShippingOrigin(status: string | undefined | null): boolean {
  return ORIGIN_EDITABLE_STATUSES.has(status ?? '');
}

/** Replace the origin on every line belonging to an overridden seller. */
export function applyOriginOverrides(
  lines: ShippableLine[],
  overrides: Record<string, OriginOverride | undefined | null>,
): ShippableLine[] {
  return lines.map((line) => {
    const over = overrides[line.sellerId];
    if (!over) return line;
    return { ...line, shippingFromCity: over.city, shippingFromCountry: over.country };
  });
}

/**
 * What the order costs after the override.
 *
 * `total = subtotal + delivery − discount`, the formula
 * `/api/create-order` uses, so a re-priced order matches one placed today
 * with the same origins. Never negative: a discount larger than the goods
 * would otherwise hand the buyer a refund at the door.
 */
export function recomputeOrderShipping(args: {
  lines: ShippableLine[];
  overrides?: Record<string, OriginOverride | undefined | null>;
  destinationCountry?: string | null;
  subtotal: number;
  discount?: number;
  isFreeDelivery?: boolean;
}): { shippingFee: number; total: number; groups: ShippingGroup[] } {
  const lines = applyOriginOverrides(args.lines, args.overrides ?? {});
  const { totalEur: shippingFee, groups } = calculateShipping(lines, {
    isFree: args.isFreeDelivery,
    destinationCountry: args.destinationCountry,
  });
  const subtotal = Number.isFinite(args.subtotal) ? args.subtotal : 0;
  const discount = Number.isFinite(args.discount ?? 0) ? args.discount ?? 0 : 0;
  return { shippingFee, total: Math.max(0, subtotal + shippingFee - discount), groups };
}
