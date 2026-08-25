/**
 * Coupon rules, in one place.
 *
 * The eligibility checks and the discount maths lived twice — inlined in
 * `/api/create-order` and again in `/api/create-payment-intent` — and the
 * client had a third, looser copy in CartContext. Three copies of a rule that
 * decides what someone pays is how a coupon comes to behave differently
 * depending on which button was pressed.
 */
import type { FirestoreCoupon } from '@/lib/types';

export interface CouponContext {
  subtotal: number;
  /** How many orders the buyer already has. Only consulted by first-order
   *  coupons; pass 0 when unknown and let the server be the authority. */
  priorOrderCount?: number;
}

export type CouponRejection =
  | 'not_found'
  | 'inactive'
  | 'min_order'
  | 'usage_limit'
  | 'not_first_order'
  | 'expired';

export interface CouponResult {
  ok: boolean;
  discount: number;
  reason?: CouponRejection;
  message?: string;
}

/** The discount a coupon is worth, never more than the subtotal itself. */
export function computeDiscount(coupon: Pick<FirestoreCoupon, 'type' | 'value'>, subtotal: number): number {
  const raw = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
  // A fixed coupon larger than the basket must not make the total negative,
  // nor start eating the delivery fee.
  return Math.max(0, Math.min(raw, subtotal));
}

export function formatMoneyEur(amount: number): string {
  return `€${(Number(amount) || 0).toFixed(2)}`;
}

/**
 * Whether a coupon may be used, and for how much.
 *
 * Deliberately pure — the caller supplies the facts. That is what lets the
 * same rules run in the browser for instant feedback and on the server, where
 * the answer actually counts.
 */
export function validateCoupon(
  coupon: FirestoreCoupon | null | undefined,
  ctx: CouponContext,
): CouponResult {
  if (!coupon) {
    return { ok: false, discount: 0, reason: 'not_found', message: 'That code is not valid.' };
  }
  if (!coupon.isActive) {
    return { ok: false, discount: 0, reason: 'inactive', message: 'This code is no longer active.' };
  }
  if (typeof coupon.usageLimit === 'number' && coupon.usageLimit > 0 && (coupon.usedCount ?? 0) >= coupon.usageLimit) {
    return { ok: false, discount: 0, reason: 'usage_limit', message: 'This code has been fully redeemed.' };
  }
  const min = coupon.minOrderValue || 0;
  if (ctx.subtotal < min) {
    return {
      ok: false,
      discount: 0,
      reason: 'min_order',
      message: `Spend at least ${formatMoneyEur(min)} to use this code.`,
    };
  }
  // A welcome discount is only a welcome if it is someone's first order.
  if (coupon.firstOrderOnly && (ctx.priorOrderCount ?? 0) > 0) {
    return {
      ok: false,
      discount: 0,
      reason: 'not_first_order',
      message: 'This code is for your first order only.',
    };
  }

  return { ok: true, discount: computeDiscount(coupon, ctx.subtotal) };
}
