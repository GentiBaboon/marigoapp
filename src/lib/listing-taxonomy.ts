/**
 * @fileOverview The vocabulary a listing is allowed to use.
 *
 * The AI listing assistant must emit values the sell wizard can actually bind
 * to its selects — `color: "coral"`, not `color: "burnt orange"`. So the model
 * is handed the live options and its output is snapped back onto them before
 * anything reaches a draft. Anything that cannot be matched is dropped rather
 * than guessed, leaving the field blank for the seller to fill in.
 *
 * Field naming is not uniform in Firestore: `conditions` documents carry
 * `value`, while `colors`/`materials`/`patterns` carry `slug`. That quirk is
 * absorbed here so callers see one shape.
 */

import { hasFirestoreRestConfig, readCollection } from '@/lib/firestore-rest';

export interface TaxonomyOption {
  /** What the seller sees. */
  name: string;
  /** What the product document stores. */
  value: string;
}

export interface ListingTaxonomy {
  brands: TaxonomyOption[];
  /** Top-level categories, e.g. Shoes, Bags. */
  categories: TaxonomyOption[];
  /** Sub-categories with the parent they belong to. */
  subcategories: (TaxonomyOption & { parent: string })[];
  conditions: TaxonomyOption[];
  materials: TaxonomyOption[];
  colors: TaxonomyOption[];
  patterns: TaxonomyOption[];
}

const EMPTY_TAXONOMY: ListingTaxonomy = {
  brands: [], categories: [], subcategories: [],
  conditions: [], materials: [], colors: [], patterns: [],
};

/** Catalog vocabulary changes rarely; an hour is plenty. */
const TTL_MS = 60 * 60 * 1000;

let cache: { at: number; taxonomy: ListingTaxonomy } | null = null;
let inFlight: Promise<ListingTaxonomy> | null = null;

/** `conditions` uses `value`; everything else uses `slug`. */
function toOption(doc: Record<string, any>): TaxonomyOption | null {
  const value = doc.slug || doc.value;
  const name = doc.name || value;
  return value ? { name, value } : null;
}

function toOptions(docs: Record<string, any>[]): TaxonomyOption[] {
  return docs.map(toOption).filter((o): o is TaxonomyOption => o !== null);
}

export async function loadListingTaxonomy(): Promise<ListingTaxonomy> {
  if (!hasFirestoreRestConfig()) return EMPTY_TAXONOMY;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.taxonomy;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [brands, categories, conditions, materials, colors, patterns] = await Promise.all([
      readCollection('brands'),
      readCollection('categories'),
      readCollection('conditions'),
      readCollection('materials'),
      readCollection('colors'),
      readCollection('patterns'),
    ]);

    const activeCategories = categories.filter((c) => c.isActive !== false && c.slug);
    const parentsById = new Map(
      activeCategories.filter((c) => !c.parentId).map((c) => [c.id, c]),
    );

    const taxonomy: ListingTaxonomy = {
      brands: toOptions(brands),
      categories: toOptions(activeCategories.filter((c) => !c.parentId)),
      subcategories: activeCategories
        .filter((c) => c.parentId)
        .map((c) => ({
          name: c.name || c.slug,
          value: c.slug,
          parent: parentsById.get(c.parentId)?.slug || '',
        }))
        // A sub-category whose parent is missing or inactive cannot be
        // represented in the wizard, which picks a parent first.
        .filter((c) => c.parent),
      conditions: toOptions(conditions),
      materials: toOptions(materials),
      colors: toOptions(colors),
      patterns: toOptions(patterns),
    };

    cache = { at: Date.now(), taxonomy };
    return taxonomy;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Lowercase + strip accents, matching the rest of the app's text matching. */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Snap a model-supplied string onto a real option.
 *
 * Tries the stored value, then the display name, then a loose containment pass
 * so "Burnt Orange" still lands on "orange" when the exact shade is absent.
 * Returns null when nothing matches — the caller leaves the field empty rather
 * than writing a value the wizard cannot render.
 */
export function matchOption(
  candidate: string | undefined | null,
  options: TaxonomyOption[],
): string | null {
  if (!candidate) return null;
  const needle = normalize(candidate);
  if (!needle) return null;

  const exact = options.find(
    (o) => normalize(o.value) === needle || normalize(o.name) === needle,
  );
  if (exact) return exact.value;

  // "dark brown" ⊃ "brown"; prefer the longest option that fits so the more
  // specific shade wins over a generic one.
  const contained = options
    .filter((o) => needle.includes(normalize(o.value)) || needle.includes(normalize(o.name)))
    .sort((a, b) => b.value.length - a.value.length)[0];
  if (contained) return contained.value;

  const reverse = options.find(
    (o) => normalize(o.value).includes(needle) || normalize(o.name).includes(needle),
  );
  return reverse ? reverse.value : null;
}
