import { describe, it, expect } from 'vitest';
import { toAttributeItems, slugifyAttribute } from '@/lib/attribute-options';

describe('toAttributeItems', () => {
  it('reads `value` when present — the shape `conditions` actually stores', () => {
    expect(toAttributeItems([{ name: 'Very Good Condition', value: 'very-good-condition' }]))
      .toEqual([{ value: 'very-good-condition', label: 'Very Good Condition' }]);
  });

  it('falls back to `slug` — the shape materials/colors/patterns store', () => {
    // The regression this module exists for: these rows have no `value` at
    // all, so reading `.value` produced `{ value: undefined }` and Radix
    // refused to render the option.
    expect(toAttributeItems([{ name: 'Dark Brown', slug: 'dark-brown', order: 16 }]))
      .toEqual([{ value: 'dark-brown', label: 'Dark Brown' }]);
  });

  it('slugifies the name when a row carries neither', () => {
    expect(toAttributeItems([{ name: 'Shell / Mother of Pearl' }]))
      .toEqual([{ value: 'shell-mother-of-pearl', label: 'Shell / Mother of Pearl' }]);
  });

  it('prefers value over slug when a row somehow has both', () => {
    expect(toAttributeItems([{ name: 'X', value: 'from-value', slug: 'from-slug' }])[0].value)
      .toBe('from-value');
  });

  it('never yields an empty value, which Radix reads as "clear selection"', () => {
    const items = toAttributeItems([
      { name: '---' },          // slugifies to nothing
      { name: '   ' },          // blank
      { name: 'Real', slug: '' },
    ]);
    expect(items).toEqual([{ value: 'real', label: 'Real' }]);
    expect(items.every(i => i.value.length > 0)).toBe(true);
  });

  it('is total over the live catalog shapes — no row is silently dropped', () => {
    const rows = [
      { name: 'Linen-Cotton Blend', slug: 'linen-cotton-blend' },
      { name: 'Color Block', slug: 'color-block', hex: '#4ECDC4' },
      { name: 'New with tag', value: 'new-with-tag' },
    ];
    expect(toAttributeItems(rows)).toHaveLength(3);
  });

  it('sorts by label and tolerates null/undefined input', () => {
    expect(toAttributeItems([{ name: 'Zinc' }, { name: 'Amber' }]).map(i => i.label))
      .toEqual(['Amber', 'Zinc']);
    expect(toAttributeItems(null)).toEqual([]);
    expect(toAttributeItems(undefined)).toEqual([]);
  });

  it('matches the values already stored on live listings', () => {
    // Guard against a future "improvement" to slugification silently
    // orphaning existing listings from their own filter facet.
    expect(slugifyAttribute('Very Good Condition')).toBe('very-good-condition');
    expect(slugifyAttribute('Genuine Leather')).toBe('genuine-leather');
    expect(slugifyAttribute('Baby Pink')).toBe('baby-pink');
  });
});
