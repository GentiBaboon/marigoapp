/**
 * Fixed option lists shared by every screen that edits a listing.
 *
 * These are small enough to look harmless inline, which is exactly why they
 * had been copied: `GENDER_OPTIONS` existed three times (the sell wizard's
 * `CategoryStep` as an anonymous literal, the seller edit page, and the admin
 * product page), and origin, packaging and the purchase-year range twice each.
 * The edit page even carried a comment — "Kept in step with originOptions in
 * components/sell/steps/DescriptionStep.tsx" — which is an admission that
 * nothing enforced it.
 *
 * That is not a hypothetical worry in this codebase. The same wizard/edit-page
 * split had already shipped three real bugs: the edit page read `.value` on
 * catalog rows that store `slug` (empty Material/Colour/Pattern dropdowns), it
 * kept a free-text size box long after every other screen moved to
 * `size-options.ts`, and it wrote `undefined` into Firestore. Each time the
 * wizard was fixed and the edit page was not.
 *
 * Unlike the catalog collections these are *not* admin-editable — they are
 * bound to code that branches on them (routing keys `women`/`men`/`children`/
 * `unisex`, the `packaging` id set) — so a module is the right home rather
 * than Firestore.
 */

export interface LabelledOption {
  value: string;
  label: string;
}

/**
 * `value` doubles as the routing key: `/women`, `/men`, `/children` are real
 * pages (see `isGenderSegment()` in `src/lib/category-url.ts`). Renaming one
 * here breaks those URLs, so treat the values as fixed and change only labels.
 */
export const GENDER_OPTIONS: readonly LabelledOption[] = [
  { value: 'women', label: 'Womenswear' },
  { value: 'men', label: 'Menswear' },
  { value: 'children', label: 'Children' },
  { value: 'unisex', label: 'Unisex' },
] as const;

/**
 * `origin` is a free string in the listing schema, not an enum, so trimming
 * this list cannot invalidate a listing already saved with a retired value.
 */
export const ORIGIN_OPTIONS: readonly LabelledOption[] = [
  { value: 'direct', label: 'Direct from brand' },
  { value: 'other', label: 'Other' },
] as const;

/** Stored as an array of ids on the listing, so the ids are load-bearing. */
export const PACKAGING_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'card', label: 'Card or certificate' },
  { id: 'dustBag', label: 'Dust bag' },
  { id: 'box', label: 'Original box' },
] as const;

/**
 * Selectable years of purchase, newest first.
 *
 * A function rather than a module constant: computing it once at import time
 * means a tab left open across New Year's Eve offers a list that no longer
 * contains the current year.
 */
export function purchaseYears(count = 30, now: Date = new Date()): string[] {
  const currentYear = now.getFullYear();
  return Array.from({ length: count }, (_, i) => String(currentYear - i));
}
