import { describe, it, expect } from 'vitest';
import {
  slugify,
  generateProductSlug,
  buildProductPath,
  extractProductId,
  hasSlug,
  uniqueSlug,
  sizeForSlug,
  MAX_SLUG_LENGTH,
} from '@/lib/product-slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Vintage Gucci Heels')).toBe('vintage-gucci-heels');
  });

  it('folds accents rather than stripping the letter', () => {
    expect(slugify('Çantë Lëkure')).toBe('cante-lekure');
    expect(slugify('Hermès Sac À Main')).toBe('hermes-sac-a-main');
  });

  it('collapses punctuation and separator runs', () => {
    expect(slugify("Levi's  501 -- Jeans!")).toBe('levi-s-501-jeans');
    expect(slugify('  spaced  out  ')).toBe('spaced-out');
  });

  it('expands & so the word survives', () => {
    expect(slugify('Dolce & Gabbana')).toBe('dolce-and-gabbana');
  });

  it('never emits the id separator', () => {
    expect(slugify('a -- b')).not.toContain('--');
  });

  it('handles empty and junk input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('generateProductSlug', () => {
  it('prefixes the brand when the title omits it', () => {
    expect(generateProductSlug({ id: 'x', title: 'Snake Print Bag', brandId: 'Zara' }))
      .toBe('zara-snake-print-bag');
  });

  it('does not repeat a brand already in the title', () => {
    expect(generateProductSlug({ id: 'x', title: 'Vintage Gucci Heels', brandId: 'Gucci' }))
      .toBe('vintage-gucci-heels');
  });

  it('appends colour and size for disambiguation', () => {
    expect(generateProductSlug({
      id: 'x', title: 'Heels', brandId: 'Zara', color: 'coral', size: '38',
    })).toBe('zara-heels-coral-38');
  });

  // A slug ending "-s" reads like a typo or a stray plural; "small" is a word
  // people search. The stored size stays canonical `S` either way.
  it('spells out letter sizes but leaves numeric ones alone', () => {
    expect(generateProductSlug({ id: 'x', title: 'Vest', brandId: 'Mango', size: 'S' }))
      .toBe('mango-vest-small');
    expect(generateProductSlug({ id: 'x', title: 'Bag', brandId: 'Guess', size: 'M' }))
      .toBe('guess-bag-medium');
    expect(generateProductSlug({ id: 'x', title: 'Heels', brandId: 'Gucci', size: '38' }))
      .toBe('gucci-heels-38');
  });

  it('does not repeat a colour already in the title', () => {
    expect(generateProductSlug({ id: 'x', title: 'Black Dress', brandId: 'Mango', color: 'black' }))
      .toBe('mango-black-dress');
  });

  it('truncates on a word boundary', () => {
    const slug = generateProductSlug({
      id: 'x',
      title: 'An Extremely Long Luxury Listing Title That Runs Well Past The Cap We Allow',
      brandId: 'Balenciaga',
    });
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
    // no half-words
    expect(slug.split('-').every(w => w.length > 0)).toBe(true);
  });

  it('returns empty when there is nothing to slug', () => {
    expect(generateProductSlug({ id: 'x' })).toBe('');
  });
});

describe('sizeForSlug', () => {
  it('maps every letter size to a readable word', () => {
    expect(sizeForSlug('S')).toBe('small');
    expect(sizeForSlug('M')).toBe('medium');
    expect(sizeForSlug('L')).toBe('large');
    expect(sizeForSlug('XS')).toBe('extra-small');
    expect(sizeForSlug('XL')).toBe('extra-large');
  });

  it('is case-insensitive about the stored value', () => {
    expect(sizeForSlug('s')).toBe('small');
  });

  it('passes through numeric and free-form sizes', () => {
    expect(sizeForSlug('38')).toBe('38');
    expect(sizeForSlug('38.5')).toBe('38-5');
    expect(sizeForSlug('One Size')).toBe('one-size');
  });

  it('handles empty input', () => {
    expect(sizeForSlug('')).toBe('');
    expect(sizeForSlug(null)).toBe('');
    expect(sizeForSlug(undefined)).toBe('');
  });
});

describe('buildProductPath', () => {
  it('is the slug alone — no id in the URL', () => {
    expect(buildProductPath({ id: 'abc', title: 'Renamed Later', seoSlug: 'original-slug' }))
      .toBe('/products/original-slug');
  });

  // Only a *stored* slug is resolvable: the page finds a listing by querying
  // seoSlug, so linking to a derived-but-unsaved slug would 404.
  it('falls back to the id when no slug is stored', () => {
    expect(buildProductPath({ id: 'abc', title: 'Gucci Heels' })).toBe('/products/abc');
    expect(buildProductPath({ id: 'abc' })).toBe('/products/abc');
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free', async () => {
    expect(await uniqueSlug('gucci-heels', async () => false)).toBe('gucci-heels');
  });

  it('appends a counter until it finds a free slug', async () => {
    const used = new Set(['gucci-heels', 'gucci-heels-2']);
    expect(await uniqueSlug('gucci-heels', async (c) => used.has(c))).toBe('gucci-heels-3');
  });

  it('keeps the suffixed slug within the length cap', async () => {
    const base = 'a'.repeat(MAX_SLUG_LENGTH);
    const out = await uniqueSlug(base, async (c) => c === base);
    expect(out.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(out.endsWith('-2')).toBe(true);
  });

  it('gives up gracefully rather than looping forever', async () => {
    const out = await uniqueSlug('taken', async () => true, 3);
    expect(out.startsWith('taken-')).toBe(true);
  });

  it('returns empty for an empty base', async () => {
    expect(await uniqueSlug('', async () => false)).toBe('');
  });
});

describe('extractProductId', () => {
  // The property the whole scheme rests on: nothing already indexed breaks.
  it('reads the id back out of a slug URL', () => {
    expect(extractProductId('vintage-gucci-heels--draft_1786018074973357'))
      .toBe('draft_1786018074973357');
  });

  it('passes a bare legacy id through unchanged', () => {
    expect(extractProductId('draft_1786018074973357')).toBe('draft_1786018074973357');
  });

  it('splits on the last separator, so an id containing one still resolves', () => {
    expect(extractProductId('some-slug--weird--id')).toBe('id');
  });

  it('accepts the array form useParams can hand back', () => {
    expect(extractProductId(['gucci-heels--abc'])).toBe('abc');
  });

  it('is stable when re-applied to its own output', () => {
    const once = extractProductId('gucci-heels--abc');
    expect(extractProductId(once)).toBe(once);
  });

  it('handles empty, null and a trailing separator', () => {
    expect(extractProductId('')).toBe('');
    expect(extractProductId(null)).toBe('');
    expect(extractProductId(undefined)).toBe('');
    expect(extractProductId('slug--')).toBe('slug--');
  });

  // The interim /products/{slug}--{id} shape shipped to production and may be
  // indexed, so it must keep resolving even though nothing emits it any more.
  it('still resolves the interim slug--id shape', () => {
    expect(extractProductId('zara-bag--draft_123')).toBe('draft_123');
  });
});

describe('hasSlug', () => {
  it('distinguishes canonical from legacy params', () => {
    expect(hasSlug('gucci-heels--abc')).toBe(true);
    expect(hasSlug('abc')).toBe(false);
  });
});
