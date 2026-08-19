import { describe, it, expect } from 'vitest';
import {
  buildCategoryPath,
  isGenderSegment,
  titleiseSlug,
  GENDER_SEGMENTS,
} from '@/lib/category-url';

describe('buildCategoryPath', () => {
  it('builds the clean two-segment path', () => {
    expect(buildCategoryPath('women', 'shirts')).toBe('/women/shirts');
    expect(buildCategoryPath('men', 'coats')).toBe('/men/coats');
  });

  it('builds the gender landing path when no category is given', () => {
    expect(buildCategoryPath('women')).toBe('/women');
    expect(buildCategoryPath('women', '')).toBe('/women');
  });

  it('normalises case and whitespace', () => {
    expect(buildCategoryPath(' Women ', ' Shirts ')).toBe('/women/shirts');
  });

  // A gender we do not route on must not produce a URL that 404s — fall back
  // to the query form, which still filters correctly.
  it('falls back to the query form for an unroutable gender', () => {
    expect(buildCategoryPath('kids', 'shirts')).toBe('/search?gender=kids&category=shirts');
    expect(buildCategoryPath('', 'shirts')).toBe('/search?category=shirts');
    expect(buildCategoryPath('')).toBe('/search');
  });

  it('covers every routed gender', () => {
    for (const g of GENDER_SEGMENTS) {
      expect(buildCategoryPath(g, 'bags')).toBe(`/${g}/bags`);
    }
  });
});

describe('isGenderSegment', () => {
  it('accepts only the four routed genders', () => {
    expect(isGenderSegment('women')).toBe(true);
    expect(isGenderSegment('unisex')).toBe(true);
    expect(isGenderSegment('about')).toBe(false);
    expect(isGenderSegment('')).toBe(false);
    expect(isGenderSegment(undefined)).toBe(false);
  });

  // These routes sit at the root, so anything that is not a gender must be
  // rejected or the catch-all swallows real pages.
  it('rejects top-level page names', () => {
    for (const p of ['about', 'help', 'search', 'browse', 'products', 'cart', 'terms']) {
      expect(isGenderSegment(p)).toBe(false);
    }
  });
});

describe('titleiseSlug', () => {
  it('turns a slug into title case', () => {
    expect(titleiseSlug('shirts')).toBe('Shirts');
    expect(titleiseSlug('shirts-and-blouses')).toBe('Shirts And Blouses');
  });

  it('handles empty input', () => {
    expect(titleiseSlug('')).toBe('');
  });
});
