import { describe, expect, it } from 'vitest';
import { isLegacyCategoryPath, isLegacySearchUrl, isLegacyUrl } from '@/lib/legacy-urls';

const sp = (qs: string) => new URLSearchParams(qs);

describe('legacy-urls', () => {
  it('recognises the old faceted search URLs Search Console still reports', () => {
    expect(isLegacySearchUrl('/search', sp('query=&size=271&color=188&size_shoes=332&brand=411'))).toBe(true);
    expect(isLegacySearchUrl('/search', sp('query&color=188&size=195'))).toBe(true);
    expect(isLegacySearchUrl('/search', sp('size_shoes=306&size_shoes=327'))).toBe(true);
    expect(isLegacySearchUrl('/search', sp('brand=438&size=8'))).toBe(true);
    expect(isLegacySearchUrl('/search', sp('color=3&page=2'))).toBe(true);
  });

  it('leaves every URL the current app emits alone', () => {
    expect(isLegacySearchUrl('/search', sp(''))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('q=zara'))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('q=zara&gender=women'))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('gender=women&category=shirts&color=black'))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('brand=zara&size=S&minPrice=10&maxPrice=50'))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('section=new-arrivals'))).toBe(false);
    expect(isLegacySearchUrl('/search', sp('size=38'))).toBe(true); // numeric sizes were ids on the old site
    expect(isLegacySearchUrl('/search', sp('size=EU-38'))).toBe(false);
  });

  it('only ever matches the search path', () => {
    expect(isLegacySearchUrl('/women', sp('query=&brand=1'))).toBe(false);
    expect(isLegacySearchUrl('/products/x', sp('size_shoes=1'))).toBe(false);
  });

  it('recognises the old numeric category paths, not slugs', () => {
    expect(isLegacyCategoryPath('/category/84')).toBe(true);
    expect(isLegacyCategoryPath('/category/40/')).toBe(true);
    expect(isLegacyCategoryPath('/category/women-id-40')).toBe(true);
    expect(isLegacyCategoryPath('/category/new-arrivals-id-53')).toBe(true);
    expect(isLegacyCategoryPath('/category/bags')).toBe(false);
    expect(isLegacyCategoryPath('/category/view')).toBe(false);
    expect(isLegacyCategoryPath('/category')).toBe(false);
    expect(isLegacyCategoryPath('/categories/84')).toBe(false);
  });

  it('isLegacyUrl combines both', () => {
    expect(isLegacyUrl('/category/84', sp('size=6&brand=365'))).toBe(true);
    expect(isLegacyUrl('/search', sp('query=&brand=1'))).toBe(true);
    expect(isLegacyUrl('/', sp(''))).toBe(false);
  });
});
