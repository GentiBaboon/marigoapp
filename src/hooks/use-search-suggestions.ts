'use client';

import * as React from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type {
  FirestoreAttribute,
  FirestoreBrand,
  FirestoreCategory,
  FirestoreProduct,
} from '@/lib/types';

/** Typing fewer characters than this matches nearly everything — not useful. */
export const MIN_QUERY_LENGTH = 2;

const PRODUCT_POOL_SIZE = 150;
const MAX_FACET_SUGGESTIONS = 6;
const MAX_PRODUCT_SUGGESTIONS = 6;

/** A facet match ("White" → colors) resolves to the filter the results page
 *  understands; free text alone would miss products whose `color` is White but
 *  whose title never says so. */
export type FacetSuggestion = {
  kind: 'facet';
  id: string;
  label: string;
  /** Human name of the facet family, shown as the row's right-hand hint. */
  facet: string;
  /** Query-string fragment for /search, e.g. `color=white`. */
  params: string;
};

export type ProductSuggestion = {
  kind: 'product';
  id: string;
  product: FirestoreProduct;
};

export type Suggestion = FacetSuggestion | ProductSuggestion;

/** A facet plus which query tokens it accounts for, used to build combinations. */
type FacetCandidate = FacetSuggestion & {
  /** Filter key ("brand", "color", …) — at most one per combined suggestion. */
  param: string;
  covered: number[];
  score: number;
};

/** `FirestoreAttribute` declares `value`, but the colour/material/pattern docs
 *  in this project actually carry the slug under `slug`. Widen locally rather
 *  than churn the shared type, which the admin screens also use. */
type CatalogAttribute = FirestoreAttribute & { slug?: string };

type SearchIndex = {
  brands: FirestoreBrand[];
  categories: FirestoreCategory[];
  colors: CatalogAttribute[];
  materials: CatalogAttribute[];
  conditions: CatalogAttribute[];
  patterns: CatalogAttribute[];
  products: FirestoreProduct[];
};

const EMPTY_INDEX: SearchIndex = {
  brands: [], categories: [], colors: [], materials: [], conditions: [], patterns: [], products: [],
};

/**
 * Module-level cache. The catalog is ~600 documents across six collections;
 * re-reading it every time the overlay mounts would bill hundreds of reads per
 * visit for data that changes maybe weekly. One fetch per page load, shared by
 * every mount, with a TTL so a long-lived tab still picks up new listings.
 */
const INDEX_TTL_MS = 5 * 60 * 1000;
let indexCache: { at: number; index: SearchIndex } | null = null;
let indexInFlight: Promise<SearchIndex> | null = null;

function cachedIndex(): SearchIndex | null {
  if (!indexCache) return null;
  if (Date.now() - indexCache.at > INDEX_TTL_MS) {
    indexCache = null;
    return null;
  }
  return indexCache.index;
}

function loadSearchIndex(firestore: NonNullable<ReturnType<typeof useFirestore>>): Promise<SearchIndex> {
  const fresh = cachedIndex();
  if (fresh) return Promise.resolve(fresh);
  // Concurrent mounts (mobile + desktop headers) share one round-trip.
  if (indexInFlight) return indexInFlight;

  const read = async <T,>(name: string): Promise<T[]> => {
    const snap = await getDocs(collection(firestore, name));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
  };

  indexInFlight = (async () => {
    const [brands, categories, colors, materials, conditions, patterns, productsSnap] =
      await Promise.all([
        read<FirestoreBrand>('brands'),
        read<FirestoreCategory>('categories'),
        read<CatalogAttribute>('colors'),
        read<CatalogAttribute>('materials'),
        read<CatalogAttribute>('conditions'),
        read<CatalogAttribute>('patterns'),
        getDocs(
          query(
            collection(firestore, 'products'),
            where('status', '==', 'active'),
            orderBy('listingCreated', 'desc'),
            limit(PRODUCT_POOL_SIZE),
          ),
        ),
      ]);
    const index: SearchIndex = {
      brands,
      categories,
      colors,
      materials,
      conditions,
      patterns,
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as FirestoreProduct),
    };
    indexCache = { at: Date.now(), index };
    return index;
  })();

  indexInFlight.finally(() => {
    indexInFlight = null;
  });

  return indexInFlight;
}

/** Lowercase + strip accents so "alaia" finds "Alaïa" and "shperblim" finds
 *  "shpërblim". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Combining marks left behind by NFD, spelled as escapes so the range
    // survives any editor or encoding round-trip.
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Match rank, lower is better: a prefix beats a word start, which beats a match
 * buried mid-word. Returns null when there's no match at all.
 */
function rank(haystack: string | undefined | null, needle: string): number | null {
  if (!haystack) return null;
  const text = normalize(haystack);
  const index = text.indexOf(needle);
  if (index < 0) return null;
  if (index === 0) return 0;
  return /\s|-|\//.test(text[index - 1]) ? 1 : 2;
}

/** Best (lowest) rank across several fields. */
function bestRank(fields: (string | undefined | null)[], needle: string): number | null {
  let best: number | null = null;
  for (const field of fields) {
    const r = rank(field, needle);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

/**
 * Every token must land somewhere, but they needn't be adjacent or in order —
 * "zara heels" has to match "Zara Orange High Heels", where the two words are
 * three words apart.
 */
function matchAllTokens(
  fields: (string | undefined | null)[],
  tokens: string[],
): number | null {
  let total = 0;
  for (const token of tokens) {
    const r = bestRank(fields, token);
    if (r === null) return null;
    total += r;
  }
  return total;
}

/** Token indices a single label satisfies, plus how well it satisfies them. */
function coverage(label: string, tokens: string[]): { covered: number[]; score: number } {
  const covered: number[] = [];
  let score = 0;
  tokens.forEach((token, i) => {
    const r = rank(label, token);
    if (r !== null) {
      covered.push(i);
      score += r;
    }
  });
  return { covered, score };
}

/**
 * Type-ahead for the search overlay. Suggests catalog facets (brand, category,
 * colour, material, condition, pattern) alongside matching live listings.
 *
 * Everything is matched in memory: Firestore has no substring or full-text
 * search, so the alternative is a third-party index. The data is fetched once
 * per page load (see the module cache above) and only when the visitor
 * actually types, so opening the overlay to browse trending costs nothing.
 */
export function useSearchSuggestions(term: string, gender: 'women' | 'men' | 'children') {
  const firestore = useFirestore();
  const trimmed = term.trim();
  const isActive = trimmed.length >= MIN_QUERY_LENGTH;

  // Memoised so the match passes below don't re-run on every unrelated render.
  const tokens = React.useMemo(
    () => normalize(trimmed).split(/\s+/).filter(Boolean),
    [trimmed],
  );

  // Latches on the first real keystroke and stays on for the life of the
  // overlay, so clearing the field doesn't discard the fetched pool.
  const [hasTyped, setHasTyped] = React.useState(false);
  React.useEffect(() => {
    if (isActive) setHasTyped(true);
  }, [isActive]);

  const [index, setIndex] = React.useState<SearchIndex | null>(() => cachedIndex());
  const [isIndexLoading, setIsIndexLoading] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !hasTyped || index) return;
    let cancelled = false;
    setIsIndexLoading(true);
    loadSearchIndex(firestore)
      .then(loaded => {
        if (!cancelled) setIndex(loaded);
      })
      .catch(() => {
        // A failed index leaves recent searches and free-text search working.
      })
      .finally(() => {
        if (!cancelled) setIsIndexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firestore, hasTyped, index]);

  const { brands, categories, colors, materials, conditions, patterns, products } =
    index ?? EMPTY_INDEX;

  const facetSuggestions = React.useMemo<FacetSuggestion[]>(() => {
    if (!isActive) return [];

    const parentBySlug = new Map<string, FirestoreCategory>();
    (categories ?? []).forEach(c => {
      if (!c.parentId) parentBySlug.set(c.id, c);
    });

    const candidates: FacetCandidate[] = [];

    const push = (
      id: string,
      label: string,
      facet: string,
      params: string,
      matchOn: string[],
    ) => {
      // A facet is described by its name and its slug; either may carry the
      // token ("genuine-leather" vs "Genuine Leather").
      const best = matchOn.reduce<{ covered: number[]; score: number } | null>((acc, field) => {
        const c = coverage(field, tokens);
        if (c.covered.length === 0) return acc;
        if (!acc || c.covered.length > acc.covered.length || (c.covered.length === acc.covered.length && c.score < acc.score)) {
          return c;
        }
        return acc;
      }, null);
      if (!best) return;
      const param = params.split('=')[0];
      candidates.push({ kind: 'facet', id, label, facet, params, param, ...best });
    };

    (brands ?? []).forEach(b => {
      if (b.slug) push(`brand:${b.id}`, b.name, 'Brand', `brand=${encodeURIComponent(b.slug)}`, [b.name, b.slug]);
    });

    // The same sub-category slug is repeated under several parents ("Shorts"
    // exists three times), and products only record the sub slug — so one row
    // per slug is both enough and safer than guessing a parent to lock, which
    // would silently over-filter when the guess is wrong.
    const seenCategorySlugs = new Set<string>();
    (categories ?? []).forEach(c => {
      if (!c.slug || c.isActive === false || seenCategorySlugs.has(c.slug)) return;
      seenCategorySlugs.add(c.slug);
      if (c.parentId) {
        const parent = parentBySlug.get(c.parentId);
        push(
          `category:${c.id}`,
          c.name,
          parent ? parent.name : 'Category',
          `category=${encodeURIComponent(c.slug)}`,
          [c.name, c.slug],
        );
      } else {
        push(`category:${c.id}`, c.name, 'Category', `categoryId=${encodeURIComponent(c.slug)}`, [c.name, c.slug]);
      }
    });

    const attributeFamilies: [CatalogAttribute[] | null | undefined, string, string][] = [
      [colors, 'Colour', 'color'],
      [materials, 'Material', 'material'],
      [conditions, 'Condition', 'condition'],
      [patterns, 'Pattern', 'pattern'],
    ];
    attributeFamilies.forEach(([list, facet, param]) => {
      (list ?? []).forEach(a => {
        // Products store the slug form ("light-pink", "very-good-condition").
        // `colors`/`materials`/`patterns` docs carry it as `slug`; `conditions`
        // uses `value` — take whichever exists.
        const value = a.slug || a.value;
        if (!value) return;
        push(`${param}:${a.id}`, a.name, facet, `${param}=${encodeURIComponent(value)}`, [a.name, value]);
      });
    });

    // Best first: cover more of the query, then match more tightly, then be the
    // shorter (i.e. less specific) label.
    candidates.sort(
      (a, b) =>
        b.covered.length - a.covered.length ||
        a.score - b.score ||
        a.label.length - b.label.length,
    );

    const out: FacetSuggestion[] = [];
    const strip = ({ covered: _c, score: _s, param: _p, ...rest }: FacetCandidate) => rest;

    // "zara heels" is two facets from two families. Combine them into one row
    // that filters on both, rather than offering each half separately.
    if (tokens.length > 1) {
      const combo: FacetCandidate[] = [];
      const claimed = new Set<number>();
      for (const c of candidates) {
        if (combo.some(picked => picked.param === c.param)) continue; // one per family
        const adds = c.covered.filter(i => !claimed.has(i));
        if (adds.length === 0) continue;
        combo.push(c);
        adds.forEach(i => claimed.add(i));
        if (claimed.size === tokens.length) break;
      }
      if (combo.length > 1 && claimed.size === tokens.length) {
        out.push({
          kind: 'facet',
          id: `combo:${combo.map(c => c.id).join('+')}`,
          label: combo.map(c => c.label).join(' · '),
          facet: combo.map(c => c.facet).join(' + '),
          params: combo.map(c => c.params).join('&'),
        });
      }
    }

    // Then the individual facets, richest coverage first.
    for (const c of candidates) {
      if (out.length >= MAX_FACET_SUGGESTIONS) break;
      out.push(strip(c));
    }
    return out.slice(0, MAX_FACET_SUGGESTIONS);
  }, [isActive, tokens, brands, categories, colors, materials, conditions, patterns]);

  const productSuggestions = React.useMemo<ProductSuggestion[]>(() => {
    if (!isActive) return [];

    return (products ?? [])
      .filter(p => p.gender === gender || p.gender === 'unisex')
      .map(p => {
        const score = matchAllTokens(
          [
            p.title,
            p.brandId,
            p.subcategoryId,
            p.categoryId,
            p.color,
            p.material,
            p.condition,
            p.size,
            (p as { pattern?: string }).pattern,
            p.description,
          ],
          tokens,
        );
        return score === null ? null : { product: p, score };
      })
      .filter((entry): entry is { product: FirestoreProduct; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score || (b.product.views ?? 0) - (a.product.views ?? 0))
      .slice(0, MAX_PRODUCT_SUGGESTIONS)
      .map(({ product }) => ({ kind: 'product' as const, id: product.id, product }));
  }, [isActive, tokens, products, gender]);

  return {
    isActive,
    facetSuggestions,
    productSuggestions,
    // Only a spinner-worthy state on the very first fetch; later keystrokes
    // filter the pool already in memory.
    isLoading: isActive && isIndexLoading && !index,
  };
}
