import { describe, it, expect } from 'vitest';
import {
  slugify,
  generateProductSlug,
  buildProductPath,
  extractProductId,
  hasSlug,
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

describe('buildProductPath', () => {
  it('uses the stored slug so URLs stay stable', () => {
    expect(buildProductPath({ id: 'abc', title: 'Renamed Later', seoSlug: 'original-slug' }))
      .toBe('/products/original-slug--abc');
  });

  it('derives a slug for listings saved before slugs existed', () => {
    expect(buildProductPath({ id: 'abc', title: 'Gucci Heels' }))
      .toBe('/products/gucci-heels--abc');
  });

  it('falls back to the bare id when no slug can be built', () => {
    expect(buildProductPath({ id: 'abc' })).toBe('/products/abc');
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

  it('round-trips whatever buildProductPath produces', () => {
    const product = { id: 'draft_123', title: 'Zara Bag', brandId: 'Zara' };
    const path = buildProductPath(product);
    expect(extractProductId(path.replace('/products/', ''))).toBe('draft_123');
  });
});

describe('hasSlug', () => {
  it('distinguishes canonical from legacy params', () => {
    expect(hasSlug('gucci-heels--abc')).toBe(true);
    expect(hasSlug('abc')).toBe(false);
  });
});
