/**
 * @fileOverview Grounding data for MarigoAI: the live catalog, plus the lookup
 * that turns "a keni ndonje gje nga Zara?" into real listings and real filter
 * links.
 *
 * Deliberately does NOT ask the model what to search for. Matching a brand name
 * is something string comparison does perfectly and an LLM does expensively and
 * occasionally wrong, so retrieval runs first and its results are handed to the
 * model as facts. That also means brand lookups still work when the model is
 * rate-limited or down.
 *
 * Matching mirrors `src/hooks/use-search-suggestions.ts` (accent-folding, token
 * ranking) so the assistant and the search overlay agree on what "zara heels"
 * means.
 *
 * Reads go through the Firestore REST API with the public web API key —
 * `products`, `brands` and `categories` are all public-read in firestore.rules,
 * and this keeps the route free of any service-account credential.
 */

import type { ChatProductCard } from '@/lib/types';
import type { ChatLink } from '@/lib/chat-knowledge';
import { expandTerm, isGarmentTerm } from '@/lib/chat-lexicon';
import {
  hasFirestoreRestConfig,
  runFirestoreQuery,
  readCollection,
} from '@/lib/firestore-rest';

/** How many active listings to hold in memory for matching. */
const PRODUCT_POOL_SIZE = 200;
/** Catalog changes slowly; listings change often. One shared TTL is fine. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Cards returned to the widget. Four fits the 2-column grid without scrolling. */
const MAX_PRODUCTS = 4;

export interface RetrievedProduct extends ChatProductCard {
  brandName: string;
  categoryId: string;
  size?: string;
  condition?: string;
  gender?: string;
}

export type { ChatLink };

export interface Retrieval {
  products: RetrievedProduct[];
  /** Filter links for facets the message named, e.g. all Zara items. */
  facetLinks: ChatLink[];
  /** Brand/category names recognised in the message, for the prompt. */
  matchedFacets: string[];
  /** True when the message looked like product hunting at all. */
  isProductQuery: boolean;
  /** Results only partially answer the query — say "similar", not "exactly". */
  isApproximate: boolean;
}

const EMPTY: Retrieval = {
  products: [], facetLinks: [], matchedFacets: [], isProductQuery: false, isApproximate: false,
};

// ── Catalog cache ───────────────────────────────────────────────────────────

interface Catalog {
  brands: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string; slug: string; parentId?: string | null }[];
  products: Record<string, any>[];
}

let cache: { at: number; catalog: Catalog } | null = null;
let inFlight: Promise<Catalog> | null = null;

async function loadCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.catalog;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [brands, categories, products] = await Promise.all([
      readCollection('brands'),
      readCollection('categories'),
      runFirestoreQuery({
        structuredQuery: {
          from: [{ collectionId: 'products' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'active' },
            },
          },
          // Matches the search overlay. Note this drops listings missing
          // `listingCreated` — the same trade-off the overlay already makes.
          orderBy: [{ field: { fieldPath: 'listingCreated' }, direction: 'DESCENDING' }],
          limit: { value: PRODUCT_POOL_SIZE },
        },
      }),
    ]);

    const catalog: Catalog = {
      brands: brands.map((b) => ({ id: b.id, name: b.name || '', slug: b.slug || '' })),
      categories: categories.map((c) => ({
        id: c.id, name: c.name || '', slug: c.slug || '', parentId: c.parentId ?? null,
      })),
      products,
    };
    cache = { at: Date.now(), catalog };
    return catalog;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

// ── Text matching (mirrors use-search-suggestions.ts) ───────────────────────

/** Lowercase + strip accents so "alaia" finds "Alaïa" and "cmimi" finds "çmimi". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Combining marks left behind by NFD, spelled as escapes so the range
    // survives any editor or encoding round-trip.
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Below this length, a token must match a *whole* word.
 *
 * Substring matching on very short tokens is almost always a false positive:
 * "Si je?" ("how are you?") pulled up Calvin Klein **Je**ans, because "je" is a
 * prefix of "jeans". Sizes ("38") and colours reached through the lexicon are
 * unaffected — those do match whole words.
 */
const WHOLE_WORD_BELOW = 4;

/** Match rank, lower is better: prefix < word-start < mid-word. Null = no match. */
function rank(haystack: string | undefined | null, needle: string): number | null {
  if (!haystack) return null;
  const text = normalize(haystack);

  if (needle.length < WHOLE_WORD_BELOW) {
    // Word-boundary scan rather than \b, which is ASCII-only and would treat
    // accented catalog text as a boundary mid-word.
    const words = text.split(/[^a-z0-9]+/);
    return words.includes(needle) ? 0 : null;
  }

  const i = text.indexOf(needle);
  if (i < 0) return null;
  if (i === 0) return 0;
  return /\s|-|\//.test(text[i - 1]) ? 1 : 2;
}

function bestRank(fields: (string | undefined | null)[], needle: string): number | null {
  let best: number | null = null;
  for (const f of fields) {
    const r = rank(f, needle);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

/**
 * Best rank for a token counting its translations and shade synonyms.
 *
 * The literal token is tried first and wins ties, so an English query still
 * prefers a literal hit over a lexicon-expanded one.
 */
function bestRankForTerm(
  fields: (string | undefined | null)[],
  alternatives: string[],
): number | null {
  let best: number | null = null;
  for (const alt of alternatives) {
    const r = bestRank(fields, alt);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

/**
 * How well a listing answers the query.
 *
 * `matched` counts how many of the query's terms landed somewhere; `score` is
 * the summed rank of those hits (lower is tighter). Callers prefer listings
 * that match every term, and fall back to the best partial matches rather than
 * reporting nothing — "taka portokalli" should surface orange heels even if
 * only one term can be resolved.
 */
function scoreTokens(
  fields: (string | undefined | null)[],
  expanded: string[][],
): { score: number; matched: number; matchedIndices: number[] } {
  let score = 0;
  const matchedIndices: number[] = [];
  expanded.forEach((alternatives, i) => {
    const r = bestRankForTerm(fields, alternatives);
    if (r !== null) {
      matchedIndices.push(i);
      score += r;
    }
  });
  return { score, matched: matchedIndices.length, matchedIndices };
}

/**
 * Words that carry no product meaning, so they don't have to be matched.
 * Both languages, plus the filler that wraps a question ("a keni ndonje gje
 * nga zara" → "zara").
 */
const STOP_WORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'do', 'does', 'have', 'has', 'you', 'your', 'i',
  'me', 'my', 'we', 'any', 'anything', 'some', 'something', 'there', 'here',
  'show', 'find', 'search', 'look', 'looking', 'for', 'from', 'with', 'want',
  'need', 'buy', 'get', 'can', 'could', 'would', 'please', 'and', 'or', 'of',
  'in', 'on', 'at', 'to', 'it', 'that', 'this', 'what', 'whats', 'available',
  'app', 'site', 'website', 'platform', 'marigo', 'marigoapp', 'products',
  'product', 'item', 'items', 'stuff', 'anymore', 'now', 'new', 'good',
  // Albanian
  'nje', 'nje', 'ka', 'kane', 'keni', 'kam', 'ke', 'a', 'e', 'te', 'i', 'me',
  'nga', 'per', 'ne', 'dhe', 'ose', 'apo', 'gje', 'gjera', 'gjeje', 'ndonje',
  'dua', 'duhet', 'mund', 'kerkoj', 'kerkoni', 'shfaq', 'me trego', 'trego',
  'blej', 'ju', 'lutem', 'faleminderit', 'ca', 'sa', 'cfare', 'cka', 'kete',
  'kjo', 'ky', 'aty', 'ketu', 'ketu', 'produkte', 'produkt', 'artikull',
  'artikuj', 'disponueshme', 'ndodhet', 'gjendet', 'dicka', 'diçka', 'dicaj',
  'ndonjegje', 'sende', 'send',
  // Small talk. The assistant answers these with personality, but they must
  // never be treated as a product search — "Si je?" was returning jeans.
  'si', 'je', 'jam', 'jeni', 'mire', 'mirë', 'faleminderit', 'pershendetje',
  'përshëndetje', 'tung', 'ckemi', 'çkemi', 'naten', 'diten', 'miredita',
  'hello', 'hey', 'thanks', 'thank', 'ok', 'okay', 'yes', 'no', 'po', 'jo',
  'how', 'are', 'doing', 'today', 'name', 'who',
]);

/** Verbs/nouns that signal the visitor is hunting for goods, not asking policy. */
const PRODUCT_INTENT = /\b(show|find|search|looking|browse|buy|shop|have|any|anything|sell(s|ing)?|available|price|cheap|under|size|wear|trego|shfaq|kerko|blej|keni|ka|ndonje|gjej|dua|çmim|cmim|masa|numri|lire|lir)\b/i;

// ── Price constraints ───────────────────────────────────────────────────────

interface PriceFilter {
  max?: number;
  min?: number;
  /** "something cheap" — no explicit number, so sort by price instead. */
  cheapest?: boolean;
}

// Matched against the *normalised* message (accents stripped), because
// JavaScript's \b is ASCII-only: against raw text, /\blire\b/ never matches
// "lirë" — the ë is not a word character, so the trailing boundary fails.
/** Words that introduce a ceiling, in both languages. */
const MAX_PRICE = /\b(?:under|below|less than|up to|max|maximum|nen|deri(?:\s+ne)?|me pak se|poshte)\s*€?\s*(\d{1,6})/i;
/** Words that introduce a floor. */
const MIN_PRICE = /\b(?:over|above|more than|min|minimum|mbi|siper|me shume se)\s*€?\s*(\d{1,6})/i;
/** "cheap" with no number attached. */
const CHEAP = /\b(?:cheap|cheapest|budget|affordable|lire|lira|lirshem)\b/i;

/**
 * Pull a price constraint out of the message.
 *
 * Without this, "a keni dicka nen 50 euro?" tokenised to {50, euro}, matched no
 * product field, and returned nothing — one of the most natural things a
 * shopper asks.
 */
export function parsePriceFilter(message: string): PriceFilter | null {
  const text = normalize(message);
  const max = MAX_PRICE.exec(text);
  const min = MIN_PRICE.exec(text);
  const filter: PriceFilter = {};

  if (max) filter.max = Number(max[1]);
  if (min) filter.min = Number(min[1]);
  if (!max && !min && CHEAP.test(text)) filter.cheapest = true;

  return filter.max !== undefined || filter.min !== undefined || filter.cheapest
    ? filter
    : null;
}

/** Numbers and currency words already consumed by the price filter. */
const PRICE_NOISE = new Set([
  'euro', 'eur', 'lek', 'leke', 'lekë', 'dollar', 'usd', '€', '$',
  'under', 'below', 'over', 'above', 'max', 'min', 'nen', 'deri', 'mbi',
  'siper', 'poshte', 'cheap', 'cheapest', 'budget', 'affordable', 'lire',
  'lira', 'cmim', 'cmimi', 'price',
]);

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Find listings and filter links relevant to a message.
 *
 * Never throws: if Firestore is unreachable the assistant should still answer
 * the "how do I sell" half of its job, so failures degrade to no results.
 */
export async function retrieveForMessage(
  message: string,
  gender?: 'women' | 'men' | 'children' | null,
): Promise<Retrieval> {
  if (!hasFirestoreRestConfig()) return EMPTY;

  const normalized = normalize(message);
  const priceFilter = parsePriceFilter(message);

  const tokens = normalized
    .split(/[^a-z0-9€$]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    // Drop the words the price filter already accounts for, so "nen 50 euro"
    // doesn't demand a listing whose text literally contains "50" or "euro".
    .filter((t) => !(priceFilter && (PRICE_NOISE.has(t) || /^\d+$/.test(t))));

  // A price-only question ("a keni dicka nen 50 euro?") is still a real query.
  if (tokens.length === 0 && !priceFilter) return EMPTY;

  let catalog: Catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error('[chat] catalog load failed:', error);
    return EMPTY;
  }

  const brandById = new Map(catalog.brands.map((b) => [b.id, b]));

  // ── Which brands / categories did they name? ──
  const genderSuffix = gender ? `&gender=${gender}` : '';
  const facetLinks: ChatLink[] = [];
  const matchedFacets: string[] = [];
  const matchedBrandIds = new Set<string>();

  for (const brand of catalog.brands) {
    if (!brand.slug) continue;
    // A brand counts as named only on a whole-token hit, so "co" doesn't drag
    // in "Coach" from an unrelated sentence.
    const hit = tokens.some((t) => rank(brand.name, t) === 0 || rank(brand.slug, t) === 0);
    if (!hit) continue;
    matchedBrandIds.add(brand.id);
    matchedFacets.push(brand.name);
    facetLinks.push({
      label: `All ${brand.name}`,
      href: `/search?brand=${encodeURIComponent(brand.slug)}${genderSuffix}`,
    });
  }

  for (const category of catalog.categories) {
    if (!category.slug) continue;
    const hit = tokens.some((t) => rank(category.name, t) === 0 || rank(category.slug, t) === 0);
    if (!hit) continue;
    matchedFacets.push(category.name);
    const param = category.parentId ? 'category' : 'categoryId';
    facetLinks.push({
      label: `Browse ${category.name}`,
      href: `/search?${param}=${encodeURIComponent(category.slug)}${genderSuffix}`,
    });
  }

  // ── Matching listings ──
  // Each token also stands for its Albanian/English counterpart and, for
  // colours, the shade names listings actually use ("portokalli" → orange →
  // coral). Without this, Albanian queries matched nothing at all.
  const expanded = tokens.map(expandTerm);

  // Which of the query's terms name a product type? These dominate a partial
  // match: asked for a black dress, we must not offer a black belt.
  const garmentIndices = tokens
    .map((t, i) => (isGarmentTerm(t) ? i : -1))
    .filter((i) => i >= 0);

  const withinBudget = (p: Record<string, any>) => {
    if (!priceFilter) return true;
    const price = Number(p.price) || 0;
    // A listing with no usable price cannot answer a price question — offering
    // a €0 item as "the cheapest" is worse than leaving it out. It still shows
    // up for every non-price query. (A large share of the catalog currently
    // has price 0; that is a data problem, not something to paper over here.)
    if (price <= 0) return false;
    if (priceFilter.max !== undefined && price > priceFilter.max) return false;
    if (priceFilter.min !== undefined && price < priceFilter.min) return false;
    return true;
  };

  const candidates = catalog.products
    .filter(withinBudget)
    .map((p) => {
      const brand = brandById.get(p.brandId);
      const brandName = brand?.name || p.brandId || '';

      // Price-only question: the budget filter above is the whole query, so
      // every surviving listing is a full match.
      if (expanded.length === 0) {
        return { product: p, brandName, score: 0, matched: 0, matchedIndices: [] };
      }

      // A named brand is decisive: every listing from it qualifies, even when
      // the rest of the sentence ("anything", "gje") matches no product field.
      if (matchedBrandIds.has(p.brandId)) {
        return {
          product: p, brandName, score: 0,
          matched: expanded.length,
          matchedIndices: expanded.map((_, i) => i),
        };
      }

      const { score, matched, matchedIndices } = scoreTokens(
        [p.title, brandName, p.brandId, p.categoryId, p.subcategoryId,
         p.color, p.material, p.condition, p.size, p.pattern, p.description],
        expanded,
      );

      return matched === 0 ? null : { product: p, brandName, score, matched, matchedIndices };
    })
    .filter((e): e is {
      product: Record<string, any>; brandName: string;
      score: number; matched: number; matchedIndices: number[];
    } => e !== null);

  // Prefer listings answering the whole query; fall back to the best partial
  // ones so a near miss shows similar items instead of "we have nothing".
  const full = candidates.filter((c) => c.matched === expanded.length);

  // When the visitor named a product type, a partial match must at least be
  // that type. "fustan te zi" with no black dress in stock should fall back to
  // other dresses, never to a black belt.
  const partial = garmentIndices.length
    ? candidates.filter((c) => c.matchedIndices.some((i) => garmentIndices.includes(i)))
    : candidates;

  const pool = full.length > 0 ? full : partial;
  const isApproximate = full.length === 0 && partial.length > 0;

  const scored = pool
    // Prefer the visitor's department, but never hide a strong match for it.
    .sort((a, b) => {
      // "something cheap" has no other ordering to go on — price is the query.
      if (priceFilter?.cheapest) {
        return (Number(a.product.price) || 0) - (Number(b.product.price) || 0);
      }
      const aGender = !gender || a.product.gender === gender || a.product.gender === 'unisex' ? 0 : 1;
      const bGender = !gender || b.product.gender === gender || b.product.gender === 'unisex' ? 0 : 1;
      return (
        b.matched - a.matched ||
        aGender - bGender ||
        a.score - b.score ||
        (b.product.views ?? 0) - (a.product.views ?? 0)
      );
    })
    .slice(0, MAX_PRODUCTS);

  const products: RetrievedProduct[] = scored.map(({ product, brandName }) => ({
    id: product.id,
    title: product.title || '',
    price: Number(product.price) || 0,
    image: product.images?.[0]?.url || '',
    brandId: brandName || product.brandId || '',
    sellerId: product.sellerId || '',
    brandName,
    categoryId: product.categoryId || '',
    size: product.size,
    condition: product.condition,
    gender: product.gender,
  }));

  return {
    products,
    facetLinks: facetLinks.slice(0, 3),
    matchedFacets,
    isProductQuery:
      products.length > 0 || matchedFacets.length > 0 || PRODUCT_INTENT.test(message),
    isApproximate,
  };
}
