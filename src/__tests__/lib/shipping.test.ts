import { describe, it, expect } from 'vitest';
import { calculateShipping, groupShippingByCity, normalizeCity, UNKNOWN_CITY } from '@/lib/shipping';
import { DEFAULT_SHIPPING_FEE_ALL, DEFAULT_SHIPPING_FEE_EUR } from '@/lib/types';

const line = (sellerId: string, city?: string | null, country?: string | null) =>
  ({ sellerId, shippingFromCity: city, shippingFromCountry: country });

/** Prices are stored in EUR; the fee is specified in ALL. */
const ALL = (n: number) => (DEFAULT_SHIPPING_FEE_EUR / DEFAULT_SHIPPING_FEE_ALL) * n;

describe('normalizeCity', () => {
  it('folds case, padding and accents onto one key', () => {
    expect(normalizeCity('Tirana')).toBe(normalizeCity(' tirana '));
    expect(normalizeCity('Korçë')).toBe(normalizeCity('korce'));
  });

  it('pools anything missing under a single origin', () => {
    expect(normalizeCity(undefined)).toBe(UNKNOWN_CITY);
    expect(normalizeCity('')).toBe(UNKNOWN_CITY);
    expect(normalizeCity('   ')).toBe(UNKNOWN_CITY);
  });
});

describe('calculateShipping', () => {
  it('charges nothing for an empty basket', () => {
    const { totalEur, groups } = calculateShipping([]);
    expect(totalEur).toBe(0);
    expect(groups).toEqual([]);
  });

  it('charges one fee for a single seller', () => {
    const { totalEur } = calculateShipping([line('s1', 'Tirana')]);
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('does not multiply by the number of items', () => {
    // Two pairs of shoes from one seller is still one courier run.
    const { totalEur } = calculateShipping([line('s1', 'Tirana'), line('s1', 'Tirana')]);
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('charges one fee when two sellers share a city', () => {
    const { totalEur, groups } = calculateShipping([line('s1', 'Tirana'), line('s2', 'Tirana')]);
    expect(totalEur).toBeCloseTo(ALL(200));
    expect(groups).toHaveLength(1);
    expect(groups[0].sellerIds.sort()).toEqual(['s1', 's2']);
  });

  it('charges per city when sellers are in different cities', () => {
    // The worked example: Tirana + Berat = 200 x 2.
    const { totalEur, groups } = calculateShipping([line('s1', 'Tirana'), line('s2', 'Berat')]);
    expect(totalEur).toBeCloseTo(ALL(400));
    expect(groups).toHaveLength(2);
  });

  it('treats differently-spelled same cities as one run', () => {
    const { totalEur } = calculateShipping([line('s1', 'Tirana'), line('s2', ' tirana ')]);
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('pools listings with no recorded city into one fee', () => {
    // Listings published before the city was stamped must not each add a fee.
    const { totalEur } = calculateShipping([line('s1'), line('s2'), line('s3', null)]);
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('separates known cities from unknown ones', () => {
    const { totalEur, groups } = calculateShipping([line('s1', 'Tirana'), line('s2')]);
    expect(groups).toHaveLength(2);
    expect(totalEur).toBeCloseTo(ALL(400));
  });

  it('waives every city when delivery is free', () => {
    // A free-delivery promotion covers the whole order, not just one city.
    const { totalEur, groups } = calculateShipping(
      [line('s1', 'Tirana'), line('s2', 'Berat')],
      { isFree: true },
    );
    expect(totalEur).toBe(0);
    expect(groups.every(g => g.feeEur === 0)).toBe(true);
  });
});

describe('groupShippingByCity', () => {
  it('keeps the seller spelling for display', () => {
    const [group] = groupShippingByCity([line('s1', 'Korçë')]);
    expect(group.label).toBe('Korçë');
  });

  it('lists each seller once per city', () => {
    const [group] = groupShippingByCity([
      line('s1', 'Tirana'), line('s1', 'Tirana'), line('s2', 'Tirana'),
    ]);
    expect(group.sellerIds).toHaveLength(2);
  });
});


/**
 * Crossing the Albania–Kosovo border costs 500 ALL instead of 200, in either
 * direction. Charged per origin city like the domestic rate.
 */
describe('cross-border delivery', () => {
  const AL = 'Albania';
  const XK = 'Kosovo';

  it('charges the domestic rate within the same country', () => {
    const { totalEur, groups } = calculateShipping(
      [line('s1', 'Tirana', AL)],
      { destinationCountry: AL },
    );
    expect(totalEur).toBeCloseTo(ALL(200));
    expect(groups[0].isCrossBorder).toBe(false);
  });

  it('charges 500 shipping from Albania into Kosovo', () => {
    const { totalEur, groups } = calculateShipping(
      [line('s1', 'Tirana', AL)],
      { destinationCountry: XK },
    );
    expect(totalEur).toBeCloseTo(ALL(500));
    expect(groups[0].isCrossBorder).toBe(true);
  });

  it('charges 500 in the other direction too', () => {
    const { totalEur } = calculateShipping(
      [line('s1', 'Prishtinë', XK)],
      { destinationCountry: AL },
    );
    expect(totalEur).toBeCloseTo(ALL(500));
  });

  it('mixes rates in one basket', () => {
    // A Tirana seller and a Prishtinë seller, delivering to Albania:
    // 200 domestic + 500 across the border.
    const { totalEur } = calculateShipping(
      [line('s1', 'Tirana', AL), line('s2', 'Prishtinë', XK)],
      { destinationCountry: AL },
    );
    expect(totalEur).toBeCloseTo(ALL(700));
  });

  it('still charges per city across the border', () => {
    // Two Kosovan cities into Albania is two crossings, not one.
    const { totalEur } = calculateShipping(
      [line('s1', 'Prishtinë', XK), line('s2', 'Prizren', XK)],
      { destinationCountry: AL },
    );
    expect(totalEur).toBeCloseTo(ALL(1000));
  });

  it('treats one city in two countries as two origins', () => {
    const groups = groupShippingByCity(
      [line('s1', 'Mitrovicë', XK), line('s2', 'Mitrovicë', AL)],
      AL,
    );
    expect(groups).toHaveLength(2);
  });

  it('falls back to the domestic rate when the destination is unknown', () => {
    // Before an address is chosen the quote must not more-than-double.
    const { totalEur } = calculateShipping([line('s1', 'Tirana', AL)]);
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('falls back to the domestic rate when the origin country is unrecorded', () => {
    // Listings published before the country was stamped.
    const { totalEur } = calculateShipping(
      [line('s1', 'Tirana')],
      { destinationCountry: XK },
    );
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('ignores country spelling and case', () => {
    const { totalEur } = calculateShipping(
      [line('s1', 'Tirana', ' albania ')],
      { destinationCountry: 'Albania' },
    );
    expect(totalEur).toBeCloseTo(ALL(200));
  });

  it('waives the border fee under free delivery', () => {
    const { totalEur } = calculateShipping(
      [line('s1', 'Prishtinë', XK)],
      { destinationCountry: AL, isFree: true },
    );
    expect(totalEur).toBe(0);
  });
});
