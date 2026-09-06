/**
 * @fileOverview What an order is worth to whom.
 *
 * An order's `totalAmount` is what the buyer pays: merchandise + delivery −
 * discount. Commission and seller earnings are owed on the **merchandise**
 * only — the delivery fee is passed through to the courier, and charging 15%
 * on it overstated commission on every order (delivery is ~10% of a typical
 * basket here). Several screens summed `totalAmount` for exactly that, and
 * the seller earnings page multiplied the *whole order* by a hardcoded 0.85,
 * including delivery and other sellers' items.
 *
 * Pure and dependency-free so the finance screens, the seller pages and the
 * API routes can all share the one definition.
 */

export interface MoneyOrderLine {
  price?: unknown;
  quantity?: unknown;
  sellerId?: string;
}

export interface MoneyOrder {
  items?: MoneyOrderLine[];
  totalAmount?: unknown;
  discountAmount?: unknown;
  /** Stored at creation since 2026-09-06; older orders derive it. */
  subtotal?: unknown;
  shippingFee?: unknown;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const qty = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 1);

/** Merchandise value of the order, optionally only one seller's lines. EUR. */
export function orderMerchandise(order: MoneyOrder | null | undefined, sellerId?: string): number {
  const lines = order?.items ?? [];
  return lines.reduce((sum, line) => {
    if (sellerId && line?.sellerId !== sellerId) return sum;
    return sum + num(line?.price) * qty(line?.quantity);
  }, 0);
}

/**
 * Delivery charged on the order. Read from `shippingFee` when stored;
 * otherwise recovered from the total, since total = merchandise + delivery −
 * discount. Never negative — a discount larger than the merchandise would
 * otherwise read as negative delivery.
 */
export function orderShipping(order: MoneyOrder | null | undefined): number {
  if (!order) return 0;
  if (typeof order.shippingFee === 'number' && Number.isFinite(order.shippingFee)) {
    return Math.max(0, order.shippingFee);
  }
  return Math.max(0, num(order.totalAmount) + num(order.discountAmount) - orderMerchandise(order));
}

/** Platform commission on the order's merchandise. */
export function orderCommission(order: MoneyOrder | null | undefined, rate: number): number {
  return orderMerchandise(order) * rate;
}

/** What one seller keeps from the order after commission. */
export function sellerNet(order: MoneyOrder | null | undefined, sellerId: string, rate: number): number {
  return orderMerchandise(order, sellerId) * (1 - rate);
}

/** Orders whose money is settled: the sale happened and the buyer has the item. */
export const SETTLED_STATUSES: ReadonlySet<string> = new Set(['completed']);
/** Orders whose money went back (or never came). */
export const REVERSED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'refunded']);

export const isSettled = (status: string | undefined) => SETTLED_STATUSES.has(status ?? '');

/**
 * Newest first, sorted in memory.
 *
 * `where('sellerIds', 'array-contains', uid)` plus `orderBy('createdAt')` is a
 * composite query and needs an index that `firestore.indexes.json` never
 * declared — so the seller wallet and earnings pages failed with
 * `failed-precondition` and showed no sales at all. A seller's own orders are
 * few enough to order here instead. `createdAt` may be an ISO string (the API
 * routes) or a Timestamp (client writes); the caller passes a date resolver.
 */
export function newestFirst<T>(rows: T[] | null | undefined, dateOf: (row: T) => Date | null): T[] {
  return [...(rows ?? [])].sort((a, b) => (dateOf(b)?.getTime() ?? 0) - (dateOf(a)?.getTime() ?? 0));
}
export const isReversed = (status: string | undefined) => REVERSED_STATUSES.has(status ?? '');
