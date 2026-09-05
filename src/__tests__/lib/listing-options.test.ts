import { describe, it, expect } from 'vitest';
import {
  GENDER_OPTIONS, ORIGIN_OPTIONS, PACKAGING_ITEMS, purchaseYears,
} from '@/lib/listing-options';
import { GENDER_SEGMENTS, isGenderSegment } from '@/lib/category-url';

describe('listing-options', () => {
  it('keeps the gender values that are also routing keys', () => {
    // `/women`, `/men`, `/children` are real indexable pages gated by
    // isGenderSegment(); renaming a value here 404s a live URL.
    expect(GENDER_OPTIONS.map(g => g.value)).toEqual(['women', 'men', 'children', 'unisex']);
  });

  it('every gender value is a real route segment', () => {
    // The constraint this replaces was a prose comment. Both lists are the
    // same four keys, and `/unisex` routes exactly like the other three, so a
    // rename on either side must fail here rather than 404 a live URL.
    expect(GENDER_OPTIONS.map(g => g.value)).toEqual([...GENDER_SEGMENTS]);
    for (const g of GENDER_OPTIONS) expect(isGenderSegment(g.value)).toBe(true);
  });

  it('keeps the packaging ids, which are what listings store', () => {
    expect(PACKAGING_ITEMS.map(p => p.id)).toEqual(['card', 'dustBag', 'box']);
  });

  it('keeps the origin values', () => {
    expect(ORIGIN_OPTIONS.map(o => o.value)).toEqual(['direct', 'other']);
  });

  it('every option carries a non-empty label', () => {
    for (const o of [...GENDER_OPTIONS, ...ORIGIN_OPTIONS]) expect(o.label.length).toBeGreaterThan(0);
    for (const p of PACKAGING_ITEMS) expect(p.label.length).toBeGreaterThan(0);
  });

  it('purchaseYears counts back from the given year, newest first', () => {
    // Local-time constructor throughout: getFullYear() reads local, so a UTC
    // literal near midnight resolves to a different year depending on the
    // machine's zone (this test first failed for exactly that reason).
    const y = purchaseYears(3, new Date(2026, 5, 1, 12));
    expect(y).toEqual(['2026', '2025', '2024']);
  });

  it('purchaseYears is computed per call, not frozen at import', () => {
    // A tab open across New Year must not keep offering a stale list.
    expect(purchaseYears(1, new Date(2026, 11, 31, 12))[0]).toBe('2026');
    expect(purchaseYears(1, new Date(2027, 0, 1, 12))[0]).toBe('2027');
  });

  it('defaults to a 30-year range', () => {
    expect(purchaseYears()).toHaveLength(30);
  });
});
