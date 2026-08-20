/**
 * Clean category URLs.
 *
 *   /search?gender=women&category=shirts   ->   /women/shirts
 *   /search?gender=women                   ->   /women
 *
 * Query strings are fine for a filter sheet but poor as landing pages: Google
 * treats them as one URL (`/search`) with parameters rather than distinct
 * pages, so none of the category combinations could rank, and nobody links to
 * a URL that looks like a form submission.
 *
 * The filter values themselves are unchanged — the routes inject exactly the
 * same `gender` / `category` filters the query string used to carry, so
 * `/women/shirts?color=black` still works and the filter sheet still writes
 * query params on top.
 */

/** Genders that may appear as the first path segment. */
export const GENDER_SEGMENTS = ['women', 'men', 'children', 'unisex'] as const;
export type GenderSegment = (typeof GENDER_SEGMENTS)[number];

export function isGenderSegment(value: string | undefined | null): value is GenderSegment {
  return !!value && (GENDER_SEGMENTS as readonly string[]).includes(value);
}

/** Human label for a gender segment, used in titles and headings. */
export const GENDER_LABELS: Record<GenderSegment, string> = {
  women: "Women's",
  men: "Men's",
  children: "Children's",
  unisex: 'Unisex',
};

/**
 * Path for a category listing page.
 *
 * `categorySlug` is the sub-category slug as stored on products (e.g.
 * `shirts`). Omit it for the gender landing page.
 */
export function buildCategoryPath(gender: string, categorySlug?: string): string {
  const g = (gender ?? '').trim().toLowerCase();
  if (!isGenderSegment(g)) {
    // Not a gender we route on — fall back to the query form so the link still
    // works rather than pointing at a 404.
    const params = new URLSearchParams();
    if (gender) params.set('gender', gender);
    if (categorySlug) params.set('category', categorySlug);
    const qs = params.toString();
    return qs ? `/search?${qs}` : '/search';
  }
  const c = (categorySlug ?? '').trim().toLowerCase();
  return c ? `/${g}/${c}` : `/${g}`;
}

/** Turn a slug back into words for a page title: `shirts` -> `Shirts`. */
export function titleiseSlug(slug: string): string {
  return (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
