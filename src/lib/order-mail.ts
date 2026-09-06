/**
 * @fileOverview Which order statuses earn the buyer an email, and whether one
 * was already sent.
 *
 * Pure so the route and its test share the rule. The status writes themselves
 * happen in the browser (seller and admin screens, under Firestore rules); the
 * email is a side effect the server performs afterwards because the SendGrid
 * key cannot ship in the bundle. See `/api/orders/notify`.
 */

export const ORDER_MAIL_STATUSES = ['shipped', 'completed', 'cancelled'] as const;
export type OrderMailStatus = (typeof ORDER_MAIL_STATUSES)[number];

export function isOrderMailStatus(status: unknown): status is OrderMailStatus {
  return typeof status === 'string' && (ORDER_MAIL_STATUSES as readonly string[]).includes(status);
}

/** Statuses this order has already been mailed about — stored on the order. */
export function mailedStatuses(order: { mailedStatuses?: unknown } | null | undefined): string[] {
  const raw = order?.mailedStatuses;
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
}

/**
 * One mail per status per order. An admin re-saving "completed", or two
 * surfaces both reacting to the same change, must not mail the buyer twice.
 */
export function alreadyMailed(order: { mailedStatuses?: unknown } | null | undefined, status: string): boolean {
  return mailedStatuses(order).includes(status);
}

export function withMailed(order: { mailedStatuses?: unknown } | null | undefined, status: string): string[] {
  const current = mailedStatuses(order);
  return current.includes(status) ? current : [...current, status];
}
