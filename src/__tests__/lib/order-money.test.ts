import { describe, it, expect } from 'vitest';
import { orderMerchandise, orderShipping, orderCommission, sellerNet, isSettled, isReversed } from '@/lib/order-money';

const order = {
  items: [
    { price: 15, quantity: 1, sellerId: 'a' },
    { price: 25, sellerId: 'b' }, // no quantity → one unit
    { price: 10, quantity: 2, sellerId: 'a' },
  ],
  totalAmount: 15 + 25 + 20 + 4.3 - 5,
  discountAmount: 5,
};

describe('orderMerchandise', () => {
  it('sums price × quantity, defaulting quantity to one', () => {
    expect(orderMerchandise(order)).toBe(60);
  });
  it('can be narrowed to one seller', () => {
    expect(orderMerchandise(order, 'a')).toBe(35);
    expect(orderMerchandise(order, 'b')).toBe(25);
    expect(orderMerchandise(order, 'nobody')).toBe(0);
  });
  it('is zero for a missing or empty order', () => {
    expect(orderMerchandise(null)).toBe(0);
    expect(orderMerchandise({ items: [] })).toBe(0);
  });
});

describe('orderShipping', () => {
  it('prefers the stored fee', () => {
    expect(orderShipping({ ...order, shippingFee: 2.15 })).toBe(2.15);
  });
  it('recovers the fee from the total on an older order', () => {
    // total = merchandise + delivery − discount → delivery = total + discount − merchandise
    expect(orderShipping(order)).toBeCloseTo(4.3);
  });
  it('never goes negative', () => {
    expect(orderShipping({ items: [{ price: 10 }], totalAmount: 0, discountAmount: 0 })).toBe(0);
  });
});

describe('commission and seller net', () => {
  it('charges commission on merchandise only, never on delivery', () => {
    expect(orderCommission(order, 0.15)).toBeCloseTo(9);
  });
  it('gives each seller their own lines less commission', () => {
    expect(sellerNet(order, 'a', 0.15)).toBeCloseTo(29.75);
    expect(sellerNet(order, 'b', 0.15)).toBeCloseTo(21.25);
  });
});

describe('status buckets', () => {
  it('only a completed order is settled', () => {
    expect(isSettled('completed')).toBe(true);
    expect(isSettled('shipped')).toBe(false);
    expect(isSettled(undefined)).toBe(false);
  });
  it('cancelled and refunded are reversed', () => {
    expect(isReversed('cancelled')).toBe(true);
    expect(isReversed('refunded')).toBe(true);
    expect(isReversed('completed')).toBe(false);
  });
});
