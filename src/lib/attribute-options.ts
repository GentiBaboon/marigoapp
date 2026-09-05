/**
 * Option lists for the catalog attribute selects — material, colour, pattern,
 * condition.
 *
 * **The stored documents do not agree on a field name.** `conditions` carries
 * `name` + `value`; `materials`, `colors` and `patterns` carry `name` + `slug`
 * + `order` and have *no* `value` at all — 296 documents of it. So a screen
 * that reads `row.value` directly builds every option as
 * `{ value: undefined }`, and a Radix `Select` will not render an item without
 * a value: the seller opens the dropdown and finds it empty, with no error
 * anywhere to say why.
 *
 * That is not hypothetical. The sell wizard patched around it inline, the edit
 * page never did, and the result was a listing whose material, colour and
 * pattern could be set at creation and then never changed again. Both now come
 * through here so the two cannot drift apart a second time.
 *
 * The resolution order is `value` → `slug` → slugified `name`, which is also
 * the order of trust: the first two are what the catalog actually stores, and
 * listings store that same form (`condition: "very-good-condition"`,
 * `color: "dark-brown"`). Slugifying the name is the last resort for a record
 * that has neither, and it is what keeps this total — every option renders.
 */

export interface AttributeOption {
  value: string;
  label: string;
}

/** Shape actually found in Firestore, as opposed to what the type claims. */
export interface AttributeRow {
  id?: string;
  name?: string;
  value?: string;
  slug?: string;
  hex?: string;
  order?: number;
}

export function slugifyAttribute(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The stored value for one row: what a listing saves and what a filter facet
 * must compare against.
 *
 * Split out from `toAttributeItems` for callers that need the rest of the row
 * as well — the `/search` colour swatches need `hex`, and every facet keys on
 * `id` — so they can attach a correct value instead of dropping to a shape
 * that has lost it.
 */
export function resolveAttributeValue(row: AttributeRow): string {
  const label = typeof row?.name === 'string' ? row.name.trim() : '';
  return (
    (typeof row?.value === 'string' && row.value.trim()) ||
    (typeof row?.slug === 'string' && row.slug.trim()) ||
    (label ? slugifyAttribute(label) : '')
  );
}

/**
 * Map catalog rows to `<Select>` items, dropping any row that cannot produce
 * both a label and a value.
 *
 * Sorted by label rather than by the stored `order`: these lists run to ~100
 * entries and a shopper-facing "order" column that nobody maintains is worse
 * than alphabetical, which is at least predictable.
 */
export function toAttributeItems(rows?: AttributeRow[] | null): AttributeOption[] {
  if (!rows) return [];

  return rows
    .filter(r => typeof r?.name === 'string' && r.name.trim().length > 0)
    .map(r => {
      const label = r.name!.trim();
      return { value: resolveAttributeValue(r), label };
    })
    // A row whose name slugifies to nothing (punctuation only) would yield an
    // empty value, which Radix treats as "clear the selection".
    .filter(o => o.value.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}
