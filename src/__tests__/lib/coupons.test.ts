import { describe, it, expect } from 'vitest';
import { validateCoupon, computeDiscount } from '@/lib/coupons';
import type { FirestoreCoupon } from '@/lib/types';

const base = (over: Partial<FirestoreCoupon> = {}): FirestoreCoupon => ({
  id: 'c1',
  code: 'WELCOME10',
  type: 'percentage',
  value: 10,
  minOrderValue: 0,
  isActive: true,
  usedCount: 0,
  createdAt: '' as any,
  updatedAt: '' as any,
  ...over,
});

describe('computeDiscount', () => {
  it('takes a percentage of the subtotal', () => {
    expect(computeDiscount({ type: 'percentage', value: 10 }, 200)).toBe(20);
  });

  it('takes a fixed amount', () => {
    expect(computeDiscount({ type: 'fixed', value: 15 }, 200)).toBe(15);
  });

  // A fixed coupon bigger than the basket must not make the total negative,
  // nor start eating the delivery fee.
  it('never exceeds the subtotal', () => {
    expect(computeDiscount({ type: 'fixed', value: 500 }, 30)).toBe(30);
  });

  it('never goes negative', () => {
    expect(computeDiscount({ type: 'fixed', value: -5 }, 30)).toBe(0);
  });
});

describe('validateCoupon', () => {
  it('accepts a valid coupon and returns the discount', () => {
    const r = validateCoupon(base(), { subtotal: 200 });
    expect(r.ok).toBe(true);
    expect(r.discount).toBe(20);
  });

  it('rejects a missing code', () => {
    expect(validateCoupon(null, { subtotal: 100 })).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('rejects an inactive coupon', () => {
    expect(validateCoupon(base({ isActive: false }), { subtotal: 100 }))
      .toMatchObject({ ok: false, reason: 'inactive' });
  });

  it('enforces the minimum order value and says the figure', () => {
    const r = validateCoupon(base({ minOrderValue: 50 }), { subtotal: 20 });
    expect(r).toMatchObject({ ok: false, reason: 'min_order' });
    expect(r.message).toContain('€50.00');
  });

  it('enforces the usage limit', () => {
    expect(validateCoupon(base({ usageLimit: 5, usedCount: 5 }), { subtotal: 100 }))
      .toMatchObject({ ok: false, reason: 'usage_limit' });
  });

  it('treats an unset usage limit as unlimited', () => {
    expect(validateCoupon(base({ usedCount: 9999 }), { subtotal: 100 }).ok).toBe(true);
  });

  // The WELCOME10 rule.
  describe('firstOrderOnly', () => {
    const welcome = base({ firstOrderOnly: true });

    it('allows a buyer with no prior orders', () => {
      const r = validateCoupon(welcome, { subtotal: 100, priorOrderCount: 0 });
      expect(r.ok).toBe(true);
      expect(r.discount).toBe(10);
    });

    it('rejects a buyer who has ordered before', () => {
      expect(validateCoupon(welcome, { subtotal: 100, priorOrderCount: 1 }))
        .toMatchObject({ ok: false, reason: 'not_first_order' });
    });

    it('does not restrict a coupon that is not first-order-only', () => {
      expect(validateCoupon(base(), { subtotal: 100, priorOrderCount: 12 }).ok).toBe(true);
    });

    // The server always supplies the real count; an omitted one must not
    // silently deny a legitimate first order.
    it('treats an unknown history as no prior orders', () => {
      expect(validateCoupon(welcome, { subtotal: 100 }).ok).toBe(true);
    });
  });

  it('checks eligibility before computing anything', () => {
    const r = validateCoupon(base({ isActive: false }), { subtotal: 200 });
    expect(r.discount).toBe(0);
  });
});
