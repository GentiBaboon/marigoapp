import { describe, it, expect } from 'vitest';
import {
  applyOriginOverrides,
  canChangeShippingOrigin,
  recomputeOrderShipping,
} from '@/lib/order-shipping-origin';
import { CROSS_BORDER_SHIPPING_FEE_EUR, DEFAULT_SHIPPING_FEE_EUR } from '@/lib/defaults';

const DOMESTIC = DEFAULT_SHIPPING_FEE_EUR;
const BORDER = CROSS_BORDER_SHIPPING_FEE_EUR;

const line = (sellerId: string, city: string | null, country: string | null) => ({
  sellerId,
  shippingFromCity: city,
  shippingFromCountry: country,
});

describe('canChangeShippingOrigin', () => {
  it('allows it while the parcel is still with the seller', () => {
    for (const s of ['confirmed', 'processing', 'in_preparation', 'prepared']) {
      expect(canChangeShippingOrigin(s)).toBe(true);
    }
  });
  it('refuses once the courier has it, or the order is over', () => {
    for (const s of ['shipped', 'delivered', 'completed', 'cancelled', 'refunded', undefined]) {
      expect(canChangeShippingOrigin(s as any)).toBe(false);
    }
  });
});

describe('applyOriginOverrides', () => {
  it('moves every line of the overridden seller and no one else’s', () => {
    const lines = [line('s1', 'Tirana', 'Albania'), line('s1', 'Tirana', 'Albania'), line('s2', 'Durres', 'Albania')];
    const out = applyOriginOverrides(lines, { s1: { city: 'Prishtina', country: 'Kosovo' } });
    expect(out.map((l) => l.shippingFromCity)).toEqual(['Prishtina', 'Prishtina', 'Durres']);
    expect(out[2].shippingFromCountry).toBe('Albania');
  });

  it('leaves the list untouched with no overrides', () => {
    const lines = [line('s1', 'Tirana', 'Albania')];
    expect(applyOriginOverrides(lines, {})).toEqual(lines);
  });
});

describe('recomputeOrderShipping', () => {
  const base = { subtotal: 20, destinationCountry: 'Albania' };

  it('keeps the domestic rate for a move within the country', () => {
    const r = recomputeOrderShipping({
      ...base,
      lines: [line('s1', 'Tirana', 'Albania')],
      overrides: { s1: { city: 'Durres', country: 'Albania' } },
    });
    expect(r.shippingFee).toBeCloseTo(DOMESTIC, 6);
    expect(r.total).toBeCloseTo(20 + DOMESTIC, 6);
  });

  it('charges the border rate once the origin leaves the buyer’s country', () => {
    const r = recomputeOrderShipping({
      ...base,
      lines: [line('s1', 'Tirana', 'Albania')],
      overrides: { s1: { city: 'Prishtina', country: 'Kosovo' } },
    });
    expect(r.shippingFee).toBeCloseTo(BORDER, 6);
    expect(r.total).toBeCloseTo(20 + BORDER, 6);
  });

  it('subtracts the discount and never goes below zero', () => {
    const r = recomputeOrderShipping({ ...base, lines: [line('s1', 'Tirana', 'Albania')], discount: 999 });
    expect(r.total).toBe(0);
  });

  it('honours free delivery', () => {
    const r = recomputeOrderShipping({
      ...base,
      lines: [line('s1', 'Tirana', 'Albania')],
      isFreeDelivery: true,
    });
    expect(r.shippingFee).toBe(0);
    expect(r.total).toBeCloseTo(20, 6);
  });

  it('still charges one run per city when two sellers share a city', () => {
    const one = recomputeOrderShipping({
      ...base,
      lines: [line('s1', 'Tirana', 'Albania'), line('s2', 'Durres', 'Albania')],
      overrides: { s1: { city: 'Durres', country: 'Albania' } },
    });
    expect(one.shippingFee).toBeCloseTo(DOMESTIC, 6);
  });
});
