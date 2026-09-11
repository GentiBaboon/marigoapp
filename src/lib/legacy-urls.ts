/**
 * @fileOverview URL shapes left over from the previous marigoapp.com site.
 *
 * Search Console (checked 2026-09-11) showed ~251K non-indexed URLs and
 * 272K Googlebot requests in 90 days against a site with ~70 real pages.
 * Nearly all of them are the *old* platform's faceted navigation, which
 * Google is still refreshing:
 *
 *   /search?query=&size=271&color=188&size_shoes=332&brand=411
 *   /category/84?size=6&brand=365          /category/women-id-40?…
 *
 * Today's `/search` answered every one of those with a 200 — it ignores
 * parameters it does not know and shows the full catalogue — so Google
 * filed them as "Duplicate without user-selected canonical" (52K) and
 * "Crawled - currently not indexed" (118K) and kept coming back. A 410 Gone
 * is the signal that makes Google drop a URL fastest; a 404 works too but
 * is treated as possibly temporary, and a robots.txt block would stop the
 * crawling while leaving the URLs in the index forever.
 *
 * The current app's search parameters are `q`, `gender`, `category`,
 * `categoryId`, `brand`, `color`, `size`, `condition`, `material`,
 * `pattern`, `minPrice`, `maxPrice`, `section` — with *names* as values
 * (`color=black`, `brand=zara`). The old site used `query`, `size_shoes`
 * and numeric ids. Those three tells never occur in a live URL, which is
 * what makes this safe to run in middleware on every request.
 */

/** Parameters that only the old site ever emitted. */
const LEGACY_ONLY_PARAMS = ['query', 'size_shoes'] as const;

/** Parameters both sites use, but where the old site's values were
 *  numeric database ids and the new site's are slugs. */
const ID_VALUED_PARAMS = ['brand', 'color', 'size'] as const;

const DIGITS = /^\d+$/;

/** True for `/search?…` requests in the old site's shape. Never for a bare
 *  `/search` or for the parameters the current app emits. */
export function isLegacySearchUrl(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname !== '/search' && pathname !== '/search/') return false;
  for (const key of LEGACY_ONLY_PARAMS) {
    if (searchParams.has(key)) return true;
  }
  for (const key of ID_VALUED_PARAMS) {
    for (const value of searchParams.getAll(key)) {
      if (DIGITS.test(value)) return true;
    }
  }
  return false;
}

/**
 * True for the old site's `/category/{numeric id}` and
 * `/category/{slug}-id-{n}` paths. The current site has no numeric category
 * ids anywhere in a URL, so a digits-only or `-id-NN` segment cannot be a
 * live page.
 */
export function isLegacyCategoryPath(pathname: string): boolean {
  const m = /^\/category\/([^/]+)\/?$/.exec(pathname);
  if (!m) return false;
  const segment = decodeURIComponent(m[1]);
  return DIGITS.test(segment) || /-id-\d+$/.test(segment);
}

/** One check for the middleware: is this request for a URL the old site
 *  had and the new one never will? */
export function isLegacyUrl(pathname: string, searchParams: URLSearchParams): boolean {
  return isLegacySearchUrl(pathname, searchParams) || isLegacyCategoryPath(pathname);
}
