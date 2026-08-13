'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Search as SearchIcon, X } from 'lucide-react';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import {
  useSearchSuggestions,
  type FacetSuggestion,
  type ProductSuggestion,
  type Suggestion,
} from '@/hooks/use-search-suggestions';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
import { useCurrency } from '@/context/CurrencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import type { FirestoreProduct } from '@/lib/types';
import { cn } from '@/lib/utils';

type DepartmentValue = 'women' | 'men' | 'children';

const DEPARTMENTS: { value: DepartmentValue; label: string }[] = [
  { value: 'women', label: 'Womenswear' },
  { value: 'men', label: 'Menswear' },
  { value: 'children', label: 'Kidswear' },
];

const TRENDING_FETCH_LIMIT = 40; // fetched unfiltered, then narrowed per department
const TRENDING_SHOWN = 12;

/** Horizontal strip of trending products with desktop scroll arrows. */
function TrendingRail({ products, isLoading, onNavigate }: {
  products: FirestoreProduct[];
  isLoading: boolean;
  onNavigate: () => void;
}) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: false });

  const syncArrows = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 8,
      // 8px slack so sub-pixel widths don't leave a permanently "enabled" arrow.
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  }, []);

  React.useEffect(() => {
    syncArrows();
  }, [syncArrows, products.length, isLoading]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div>
      <h2 className="mb-4 text-sm text-muted-foreground">Trending</h2>

      {!isLoading && products.length === 0 && (
        // Departments with no live listings still need to say something —
        // an empty column reads as a broken panel.
        <p className="text-sm text-muted-foreground">Nothing trending here yet.</p>
      )}

      <div className="group relative">
        <div
          ref={railRef}
          onScroll={syncArrows}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading
            ? [...Array(5)].map((_, i) => (
                <Skeleton key={i} className="aspect-square w-32 flex-shrink-0 md:w-40" />
              ))
            : products.map(product => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={onNavigate}
                  className="group/tile w-32 flex-shrink-0 snap-start md:w-40"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {product.images?.[0]?.url ? (
                      <Image
                        src={product.images[0].thumbnailUrl || product.images[0].url}
                        alt={product.title}
                        fill
                        sizes="160px"
                        className="object-contain transition-transform duration-300 group-hover/tile:scale-105"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">{product.title}</p>
                </Link>
              ))}
        </div>

        {/* Pointer-only affordance — touch devices just swipe the rail. */}
        {([-1, 1] as const).map(direction => {
          const enabled = direction === -1 ? canScroll.left : canScroll.right;
          const Icon = direction === -1 ? ChevronLeft : ChevronRight;
          return (
            <button
              key={direction}
              type="button"
              aria-label={direction === -1 ? 'Scroll trending left' : 'Scroll trending right'}
              onClick={() => scrollByPage(direction)}
              className={cn(
                'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center border bg-background shadow-sm transition-opacity hover:bg-muted md:flex',
                direction === -1 ? 'left-0' : 'right-0',
                enabled ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Highlights every matched token so it's obvious why a row came back — the
 *  words of a query like "zara heels" land in different parts of the title. */
function Highlight({ text, term }: { text: string; term: string }) {
  const tokens = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;

  const lower = text.toLowerCase();
  // Mark every occurrence of every token, then merge into disjoint spans so
  // overlapping tokens ("lea" + "leather") don't split a word oddly.
  const spans: [number, number][] = [];
  tokens.forEach(token => {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(token, from);
      if (at < 0) break;
      spans.push([at, at + token.length]);
      from = at + token.length;
    }
  });
  if (spans.length === 0) return <>{text}</>;

  spans.sort((a, b) => a[0] - b[0]);
  const merged = spans.reduce<[number, number][]>((acc, span) => {
    const last = acc[acc.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else acc.push([...span] as [number, number]);
    return acc;
  }, []);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={i} className="bg-transparent font-semibold text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** Type-ahead results: catalog facets first, then matching listings. */
function SuggestionList({
  id,
  term,
  facets,
  products,
  isLoading,
  highlighted,
  onHighlight,
  onPick,
  onSeeAll,
  formatPrice,
}: {
  id: string;
  term: string;
  facets: FacetSuggestion[];
  products: ProductSuggestion[];
  isLoading: boolean;
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (suggestion: Suggestion) => void;
  onSeeAll: () => void;
  formatPrice: (priceInEur: number) => string;
}) {
  const rowClass = (index: number) =>
    cn(
      'flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors',
      index === highlighted ? 'bg-muted' : 'hover:bg-muted/60',
    );

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3" id={id}>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const isEmpty = facets.length === 0 && products.length === 0;

  return (
    <div className="mt-6" id={id} role="listbox" aria-label="Search suggestions">
      {isEmpty && (
        <p className="px-2 text-sm text-muted-foreground">
          No matches for “{term.trim()}”. Try a brand, colour, or category.
        </p>
      )}

      {facets.length > 0 && (
        <ul className="-mx-2">
          {facets.map((facet, index) => (
            <li key={facet.id}>
              <button
                type="button"
                id={`search-suggestion-${facet.id}`}
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => onHighlight(index)}
                onClick={() => onPick(facet)}
                className={rowClass(index)}
              >
                <SearchIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-base">
                  <Highlight text={facet.label} term={term} />
                </span>
                {/* Capped rather than flex-shrink-0: a combined row's hint
                    ("COLOUR + CLOTHING + PATTERN") would otherwise squeeze the
                    label it's describing off the row on a phone. */}
                <span className="max-w-[45%] truncate text-xs uppercase tracking-wide text-muted-foreground">
                  {facet.facet}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {products.length > 0 && (
        <>
          <h2 className="mb-1 mt-4 px-0 text-sm text-muted-foreground">Products</h2>
          <ul className="-mx-2">
            {products.map((entry, i) => {
              const index = facets.length + i;
              const { product } = entry;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    id={`search-suggestion-${entry.id}`}
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseEnter={() => onHighlight(index)}
                    onClick={() => onPick(entry)}
                    className={rowClass(index)}
                  >
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden bg-muted">
                      {product.images?.[0]?.url ? (
                        <Image
                          src={product.images[0].thumbnailUrl || product.images[0].url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <Highlight text={product.title} term={term} />
                      </span>
                      {product.brandId && (
                        <span className="block truncate text-xs capitalize text-muted-foreground">
                          {product.brandId}
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-sm">{formatPrice(product.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={onSeeAll}
        className="mt-3 inline-block px-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
      >
        See all results for “{term.trim()}”
      </button>
    </div>
  );
}

/**
 * Farfetch-style search panel: departments + trending on one side, the query
 * field and recent searches on the other. Renders as a dropdown under the
 * header on desktop and as a full-screen sheet on mobile.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const firestore = useFirestore();
  const preference = useShoppingPreference();
  const { formatPrice } = useCurrency();
  const { terms: recentSearches, add: addRecentSearch, remove: removeRecentSearch } = useRecentSearches();

  const [term, setTerm] = React.useState('');
  const [department, setDepartment] = React.useState<DepartmentValue>(
    preference === 'men' ? 'men' : 'women',
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Escape closes from anywhere, and the page behind must not scroll while the
  // panel is open (it covers the whole screen on mobile).
  React.useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // Department is applied client-side: adding `gender` to the query would need
  // a (status, gender, views) composite index we haven't deployed, and 40 rows
  // is cheap enough to narrow in memory.
  const trendingQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'products'),
            where('status', '==', 'active'),
            orderBy('views', 'desc'),
            limit(TRENDING_FETCH_LIMIT),
          )
        : null,
    [firestore],
  );
  const { data: trendingProducts, isLoading: isTrendingLoading } =
    useCollection<FirestoreProduct>(trendingQuery);

  const departmentProducts = React.useMemo(
    () =>
      (trendingProducts ?? [])
        .filter(p => p.gender === department || p.gender === 'unisex')
        .slice(0, TRENDING_SHOWN),
    [trendingProducts, department],
  );

  const { isActive: hasQuery, facetSuggestions, productSuggestions, isLoading: isSuggestLoading } =
    useSearchSuggestions(term, department);

  // Flattened for arrow-key navigation, in the order the rows are rendered.
  const suggestions: Suggestion[] = React.useMemo(
    () => [...facetSuggestions, ...productSuggestions],
    [facetSuggestions, productSuggestions],
  );
  const [highlighted, setHighlighted] = React.useState(-1);
  React.useEffect(() => setHighlighted(-1), [term]);

  const runSearch = (rawTerm: string) => {
    const trimmed = rawTerm.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}&gender=${department}`);
    onClose();
  };

  // A facet resolves to its filter rather than a text query, so "White" finds
  // every white item, not just the ones with "white" in the title.
  const openFacet = (suggestion: FacetSuggestion) => {
    addRecentSearch(suggestion.label);
    router.push(`/search?${suggestion.params}&gender=${department}`);
    onClose();
  };

  const openSuggestion = (suggestion: Suggestion) => {
    if (suggestion.kind === 'facet') {
      openFacet(suggestion);
      return;
    }
    router.push(`/products/${suggestion.product.id}`);
    onClose();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // -1 means "no row picked"; wrapping through it lets Enter fall back to a
      // plain text search without clearing the list.
      setHighlighted(prev => {
        const next = prev + step;
        if (next < -1) return suggestions.length - 1;
        if (next >= suggestions.length) return -1;
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      const picked = suggestions[highlighted];
      if (picked) openSuggestion(picked);
      else runSearch(term);
    }
  };

  return (
    <>
      {/* Dims the page under the desktop dropdown; the mobile panel is opaque
          and full-screen, so no backdrop is needed there. */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute left-0 top-full hidden h-screen w-screen bg-black/30 md:block"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background md:absolute md:inset-auto md:left-0 md:top-full md:z-auto md:block md:max-h-[calc(100svh-5rem)] md:w-full md:border-b md:shadow-lg"
      >
        {/* px-4 (not the container default 2rem) so the panel's content lines
            up with the header row above it. */}
        <div className="container px-4 py-4 md:py-8">
          {/* min-w-0 on both columns: without it the grid tracks size to the
              trending rail's max-content (~1700px) and the close/remove
              buttons land off-screen. */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8 lg:gap-12">
            {/* Query + history. First on mobile so the keyboard target is at
                the top; right-hand column on desktop. */}
            <div className="min-w-0 md:order-2">
              <div className="flex items-center gap-3 border-b pb-2">
                <SearchIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  type="search"
                  role="combobox"
                  aria-label="Search products"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="search-suggestions"
                  aria-activedescendant={
                    highlighted >= 0 ? `search-suggestion-${suggestions[highlighted]?.id}` : undefined
                  }
                  autoComplete="off"
                  placeholder="What are you looking for?"
                  className="w-full bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground md:text-lg"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close search"
                  className="flex-shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-5 w-5 md:h-6 md:w-6" />
                </button>
              </div>

              {hasQuery ? (
                <SuggestionList
                  id="search-suggestions"
                  term={term}
                  facets={facetSuggestions}
                  products={productSuggestions}
                  isLoading={isSuggestLoading}
                  highlighted={highlighted}
                  onHighlight={setHighlighted}
                  onPick={openSuggestion}
                  onSeeAll={() => runSearch(term)}
                  formatPrice={formatPrice}
                />
              ) : recentSearches.length > 0 && (
                <div className="mt-6">
                  <h2 className="mb-2 text-sm text-muted-foreground">Recent searches</h2>
                  <ul>
                    {recentSearches.map(recent => (
                      <li key={recent} className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => runSearch(recent)}
                          className="flex-1 truncate py-2.5 text-left text-base hover:underline md:text-lg"
                        >
                          {recent}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentSearch(recent)}
                          aria-label={`Remove ${recent} from recent searches`}
                          className="flex-shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Departments + trending. */}
            <div className="min-w-0 md:order-1 md:border-r md:pr-8 lg:pr-12">
              <div
                role="tablist"
                aria-label="Department"
                className="mb-6 flex items-center gap-5 overflow-x-auto border-b lg:gap-8"
              >
                {DEPARTMENTS.map(dept => {
                  const isActive = dept.value === department;
                  return (
                    <button
                      key={dept.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setDepartment(dept.value)}
                      className={cn(
                        'whitespace-nowrap border-b-2 pb-3 text-sm font-medium uppercase tracking-wide transition-colors',
                        isActive
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {dept.label}
                    </button>
                  );
                })}
              </div>

              <TrendingRail
                products={departmentProducts}
                isLoading={isTrendingLoading}
                onNavigate={onClose}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
