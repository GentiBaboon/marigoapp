import { describe, it, expect } from 'vitest';
import {
  normalizeSize,
  sizesMatch,
  resolveSizeOptions,
  resolveSizeSystems,
  SIZE_PRESETS,
  UNIVERSAL_SIZES,
  sizeLabel,
} from '@/lib/size-options';

describe('normalizeSize', () => {
  it('folds long letter spellings onto the canonical value', () => {
    expect(normalizeSize('Small')).toBe('S');
    expect(normalizeSize('small')).toBe('S');
    expect(normalizeSize('Medium')).toBe('M');
    expect(normalizeSize('Large')).toBe('L');
    expect(normalizeSize('Extra Small')).toBe('XS');
    expect(normalizeSize('extra-large')).toBe('XL');
    expect(normalizeSize('2XL')).toBe('XXL');
    expect(normalizeSize('XXXL')).toBe('3XL');
  });

  it('collapses the many spellings of one size', () => {
    expect(normalizeSize('one size')).toBe('One Size');
    expect(normalizeSize('OS')).toBe('One Size');
    expect(normalizeSize('Taglia Unica')).toBe('One Size');
  });

  it('normalises numeric sizes, including comma decimals', () => {
    expect(normalizeSize('38')).toBe('38');
    expect(normalizeSize(' 38 ')).toBe('38');
    expect(normalizeSize('38,5')).toBe('38.5');
    expect(normalizeSize('38.0')).toBe('38');
    expect(normalizeSize('08')).toBe('8');
  });

  it('strips a size system that was typed into the value', () => {
    expect(normalizeSize('EU 38')).toBe('38');
    expect(normalizeSize('38 EU')).toBe('38');
    expect(normalizeSize('Size 42')).toBe('42');
  });

  it('normalises kidswear ages', () => {
    expect(normalizeSize('12 months')).toBe('12M');
    expect(normalizeSize('3-6 months')).toBe('3-6M');
    expect(normalizeSize('4 years')).toBe('4Y');
    expect(normalizeSize('110 cm')).toBe('110');
  });

  it('returns empty for blank input and never throws', () => {
    expect(normalizeSize('')).toBe('');
    expect(normalizeSize(null)).toBe('');
    expect(normalizeSize(undefined)).toBe('');
    expect(normalizeSize('   ')).toBe('');
  });

  it('passes through a value it does not recognise', () => {
    expect(normalizeSize('Custom Fit')).toBe('Custom Fit');
  });
});

describe('sizesMatch', () => {
  // The regression this whole module exists for: a listing saved as "Small"
  // was unreachable from the "S" filter pill.
  it('matches a legacy free-text size against the canonical pill', () => {
    expect(sizesMatch('Small', 'S')).toBe(true);
    expect(sizesMatch('Medium', 'M')).toBe(true);
    expect(sizesMatch('EU 38', '38')).toBe(true);
    expect(sizesMatch('38,5', '38.5')).toBe(true);
  });

  it('does not match different sizes', () => {
    expect(sizesMatch('S', 'M')).toBe(false);
    expect(sizesMatch('38', '39')).toBe(false);
  });

  it('treats a blank on either side as no match', () => {
    expect(sizesMatch('', 'S')).toBe(false);
    expect(sizesMatch('S', null)).toBe(false);
  });
});

describe('resolveSizeOptions', () => {
  const charts = [
    { categoryType: 'Shoes', sizeSystem: 'EU', sizes: ['40', '41'], isActive: true },
    { categoryType: 'Shoes', sizeSystem: 'UK', sizes: [], isActive: true },
    { categoryType: 'Bags', sizeSystem: 'International', sizes: ['S'], isActive: false },
  ];

  it('prefers the admin chart over the built-in preset', () => {
    const out = resolveSizeOptions({ categoryType: 'Shoes', sizeSystem: 'EU', charts });
    expect(out.map(o => o.value)).toEqual(['40', '41']);
  });

  it('falls back to the preset when the chart is empty or inactive', () => {
    const out = resolveSizeOptions({ categoryType: 'Shoes', sizeSystem: 'UK', charts });
    expect(out.map(o => o.value)).toEqual(SIZE_PRESETS.Shoes!.UK);

    const bags = resolveSizeOptions({ categoryType: 'Bags', sizeSystem: 'International', charts });
    expect(bags.map(o => o.value)).toEqual(SIZE_PRESETS.Bags!.International);
  });

  it('offers every preset size when no system is chosen yet', () => {
    const out = resolveSizeOptions({ categoryType: 'Clothing', charts: [] });
    expect(out.map(o => o.value)).toContain('S');
    expect(out.map(o => o.value)).toContain('42');
  });

  // The property that removes the free-text box: no combination is ever empty.
  it('never returns an empty list, for any category', () => {
    const categories = [...Object.keys(SIZE_PRESETS), 'Brand New Category', '', undefined];
    for (const categoryType of categories) {
      for (const sizeSystem of ['EU', 'US', 'UK', 'IT', 'FR', 'International', '', undefined]) {
        const out = resolveSizeOptions({ categoryType, sizeSystem, charts: [] });
        expect(out.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the universal list for an unknown category', () => {
    const out = resolveSizeOptions({ categoryType: 'Brand New Category', charts: [] });
    expect(out.map(o => o.value)).toEqual(UNIVERSAL_SIZES);
  });

  it('returns no duplicate values', () => {
    for (const categoryType of Object.keys(SIZE_PRESETS)) {
      const out = resolveSizeOptions({ categoryType, charts: [] });
      expect(new Set(out.map(o => o.value)).size).toBe(out.length);
    }
  });
});

describe('presets', () => {
  // Guards the exact data bug found in production: the Home chart shipped
  // Small/Medium/Large while every other chart used S/M/L, so the two split
  // the same inventory across two pills.
  it('never offers a long letter spelling as its own option', () => {
    const banned = ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA SMALL', 'EXTRA LARGE'];
    const all = [...Object.values(SIZE_PRESETS).flatMap(p => Object.values(p).flat()), ...UNIVERSAL_SIZES];
    for (const size of all) {
      expect(banned).not.toContain(String(size).toUpperCase());
    }
  });

  it('is self-consistent: every preset value is its own canonical form', () => {
    const all = Object.values(SIZE_PRESETS).flatMap(p => Object.values(p).flat());
    for (const size of all) {
      expect(normalizeSize(size as string)).toBe(size);
    }
  });

  it('covers every top-level category currently in the catalog', () => {
    const live = [
      'Clothing', 'Bags', 'Shoes', 'Active Wear', 'Accessories', 'Jewellery & Watches',
      'Clothing for Girls', 'Clothing for Boys', 'Baby', "Children's Accessories",
      "Children's Shoes", 'Beauty & Skincare', 'Home', 'Art',
    ];
    for (const name of live) {
      expect(SIZE_PRESETS[name], `missing preset for ${name}`).toBeDefined();
    }
  });
});

describe('resolveSizeSystems', () => {
  it('lists systems in canonical order', () => {
    const out = resolveSizeSystems('Shoes', []);
    expect(out).toEqual(['EU', 'US', 'UK', 'IT', 'FR', 'International']);
  });

  it('falls back to all systems for an unknown category', () => {
    expect(resolveSizeSystems('Nope', []).length).toBeGreaterThan(0);
  });
});

describe('sizeLabel', () => {
  it('carries the long form so sellers can search for it', () => {
    expect(sizeLabel('S')).toBe('S — Small');
    expect(sizeLabel('M')).toBe('M — Medium');
  });

  it('leaves numeric sizes alone', () => {
    expect(sizeLabel('38')).toBe('38');
    expect(sizeLabel('One Size')).toBe('One Size');
  });
});
