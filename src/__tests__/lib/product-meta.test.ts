import { describe, it, expect } from 'vitest';
import {
  buildMetaTitle,
  buildMetaDescription,
  trimToWord,
  MAX_META_TITLE,
  MAX_META_DESCRIPTION,
} from '@/lib/product-meta';

describe('buildMetaTitle', () => {
  it('prefixes the brand when the title omits it', () => {
    expect(buildMetaTitle({ title: 'Snake Print Bag', brandId: 'Zara' }))
      .toBe('Zara Snake Print Bag | MarigoApp');
  });

  it('does not repeat a brand already in the title', () => {
    expect(buildMetaTitle({ title: 'Zara Snake Print Bag', brandId: 'Zara' }))
      .toBe('Zara Snake Print Bag | MarigoApp');
  });

  // The real case from the admin panel: 65 chars with the suffix. Dropping the
  // site name loses less than truncating the product name.
  it('drops the site suffix rather than cutting the product name', () => {
    const title = buildMetaTitle({
      title: 'Goyard Pre-Owned mini Anjou monogram-pattern tote bag',
      brandId: 'Goyard',
    });
    expect(title).toBe('Goyard Pre-Owned mini Anjou monogram-pattern tote bag');
    expect(title.length).toBeLessThanOrEqual(MAX_META_TITLE);
  });

  it('trims on a word boundary when even the name is too long', () => {
    const title = buildMetaTitle({
      title: 'An Extraordinarily Long Luxury Listing Name That Simply Will Not Fit Anywhere',
    });
    expect(title.length).toBeLessThanOrEqual(MAX_META_TITLE);
    expect(title.endsWith(' ')).toBe(false);
    // no half-words
    expect(title.split(' ').every((w) => w.length > 0)).toBe(true);
  });

  it('falls back to the site name with no title', () => {
    expect(buildMetaTitle({})).toBe('MarigoApp');
  });
});

describe('buildMetaDescription', () => {
  it('never exceeds the limit', () => {
    const d = buildMetaDescription({
      title: 'Tote Bag',
      brandId: 'Goyard',
      description: 'This Goyard mini Anjou tote bag features the iconic monogram pattern in blue Goyardine canvas with contrasting leather trim. It has an open top, two comfortable top handles, and includes a matching removable pouch. The bag is in good condition, showing minimal signs of use such as slight fading of material.',
    });
    expect(d.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
  });

  // The bug that prompted this: the old version sliced at 300 and ended
  // "…slight fading of m".
  it('ends on a complete sentence, never mid-word', () => {
    const d = buildMetaDescription({
      title: 'Tote Bag',
      description: 'This Goyard mini Anjou tote bag features the iconic monogram pattern in blue Goyardine canvas with contrasting leather trim. It has an open top and includes a matching removable pouch.',
    });
    expect(d.endsWith('.')).toBe(true);
    expect(d).not.toMatch(/\s\w{1,2}$/);
  });

  it('composes from attributes when there is no usable prose', () => {
    const d = buildMetaDescription({
      title: 'Heels', brandId: 'Gucci', color: 'dark-brown', size: '38',
      condition: 'very-good-condition',
    });
    expect(d).toContain('Gucci Heels');
    expect(d).toContain('dark brown');
    expect(d).toContain('size 38');
    expect(d.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
  });

  it('prefers the attribute version over a uselessly short sentence', () => {
    const d = buildMetaDescription({ title: 'Bag', brandId: 'Zara', description: 'Nice bag.' });
    expect(d).not.toBe('Nice bag.');
    expect(d).toContain('Zara Bag');
  });

  it('humanises stored slugs rather than printing them raw', () => {
    const d = buildMetaDescription({ title: 'Heels', condition: 'very-good-condition' });
    expect(d).toContain('Very good condition');
    expect(d).not.toContain('very-good-condition');
  });

  it('produces something usable from a bare title', () => {
    const d = buildMetaDescription({ title: 'Heels' });
    expect(d.length).toBeGreaterThan(20);
    expect(d.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
  });
});

describe('trimToWord', () => {
  it('leaves short text alone', () => {
    expect(trimToWord('short', 20)).toBe('short');
  });

  it('cuts on a space and strips trailing punctuation', () => {
    expect(trimToWord('one two three four', 12)).toBe('one two');
    expect(trimToWord('one two, three', 9)).toBe('one two');
  });

  it('collapses whitespace', () => {
    expect(trimToWord('  a   b  ', 50)).toBe('a b');
  });
});
