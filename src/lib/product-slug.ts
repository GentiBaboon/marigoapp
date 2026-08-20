/**
 * SEO URLs for listings.
 *
 * Products live at `/products/{firestoreId}`, and the ids this app generates
 * look like `draft_1786018061595258` — a URL with no keyword in it at all.
 * Google weights the path, and a shopper deciding whether to click a result
 * reads it, so every listing was throwing away its single best on-page signal.
 *
 * The canonical form is the slug alone:
 *
 *     /products/vintage-gucci-heels-dark-brown-38
 *
 * Which means a listing is resolved by **querying** `seoSlug`, not by reading a
 * document id. Three consequences, all handled here:
 *
 *   1. Slugs must be unique. `uniqueSlug()` appends `-2`, `-3`, … when a base
 *      slug is already taken.
 *   2. Every listing needs a *stored* slug. Products published before slugs
 *      existed are backfilled by `scripts/backfill-slugs.mjs`; until one has a
 *      slug, `buildProductPath` falls back to `/products/{id}` so it keeps
 *      working rather than 404ing.
 *   3. Two older URL shapes must still resolve, because they are already
 *      indexed and shared: the bare `/products/{id}`, and the interim
 *      `/products/{slug}--{id}`. `extractProductId()` recovers the id from the
 *      second; callers try the slug query first and fall back to a document
 *      read.
 */

/** Product fields this module needs. Structural, so both `FirestoreProduct` and
 *  the lighter SEO/sitemap shapes satisfy it. */
export interface SluggableProduct {
  id: string;
  title?: string;
  brandId?: string;
  size?: string;
  color?: string;
  seoSlug?: string;
}

const SEPARATOR = '--';

/** Longest slug we will generate. Google truncates display well before this. */
export const MAX_SLUG_LENGTH = 70;

/**
 * Lowercase, ASCII, hyphen-separated.
 *
 * Accents are folded rather than stripped so Albanian and Italian titles stay
 * readable: "Çantë Lëkure" becomes `cante-lekure`, not `cant-lkure`.
 */
export function slugify(input: string): string {
  return (input ?? '')
    .normalize('NFD')
    // Combining marks left behind by NFD — this is what folds é → e.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[đĐ]/g, 'd')
    .replace(/[łŁ]/g, 'l')
    .replace(/[øØ]/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[&]/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Trim to a length limit without cutting a word in half. */
function truncateOnWord(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, '');
}

/**
 * Build the slug for a listing: brand, then title, then the distinguishing
 * attributes a shopper would actually search with.
 *
 * The brand is only prefixed when the title does not already contain it —
 * "Gucci" + "Vintage Gucci Heels" would otherwise read `gucci-vintage-gucci-heels`,
 * which is the keyword repetition Google discounts.
 */
export function generateProductSlug(product: SluggableProduct): string {
  const title = slugify(product.title ?? '');
  const brand = slugify(product.brandId ?? '');

  const parts: string[] = [];
  if (brand && !title.includes(brand)) parts.push(brand);
  if (title) parts.push(title);

  // Size and colour disambiguate near-identical listings from one seller, and
  // match how people search ("black gucci heels 38").
  const color = slugify(product.color ?? '');
  if (color && !parts.join('-').includes(color)) parts.push(color);
  const size = slugify(product.size ?? '');
  if (size) parts.push(size);

  const slug = truncateOnWord(parts.join('-'), MAX_SLUG_LENGTH);
  // A listing with no title at all falls back to the bare id path.
  return slug || '';
}

/**
 * The canonical path for a listing.
 *
 * Prefers the stored `seoSlug` so the URL is stable: regenerating from the
 * title on every render would silently change a listing's URL whenever an
 * admin fixed a typo, discarding whatever ranking it had. Products saved
 * before slugs existed fall back to a derived one rather than a bare id.
 */
export function buildProductPath(product: SluggableProduct): string {
  // Only a *stored* slug can be resolved — a derived one is not in Firestore,
  // so linking to it would 404. Products awaiting backfill keep their id URL.
  const slug = product.seoSlug?.trim();
  return slug ? `/products/${slug}` : `/products/${product.id}`;
}

/**
 * Append a numeric suffix until the slug is free.
 *
 * `isTaken` is injected so this stays a pure function testable without
 * Firestore, and usable from both the client SDK and a REST script.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  limit = 50,
): Promise<string> {
  if (!base) return '';
  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= limit; n += 1) {
    const candidate = truncateOnWord(base, MAX_SLUG_LENGTH - String(n).length - 1) + `-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Pathological case — fall back to something guaranteed free.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Recover the document id from whatever is in the `[id]` segment.
 *
 * Accepts both `slug--id` and a bare `id`, so old links, native `?id=` params
 * and anything already indexed all resolve to the same document.
 */
export function extractProductId(param: string | string[] | undefined | null): string {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return '';
  const decoded = String(raw);
  const at = decoded.lastIndexOf(SEPARATOR);
  if (at === -1) return decoded;
  const id = decoded.slice(at + SEPARATOR.length);
  // A trailing separator with nothing after it is malformed — fall back to the
  // whole string rather than returning empty and 404ing a valid listing.
  return id || decoded;
}

/** True when the param already carries a slug, i.e. it is the canonical form. */
export function hasSlug(param: string): boolean {
  return param.includes(SEPARATOR);
}
