'use client';

/**
 * Infinite scroll, in two halves.
 *
 * `useInfiniteScroll` watches a sentinel element and calls back when it comes
 * into view. `usePagedList` windows an array that is already in memory. Screens
 * use one or both depending on where their data comes from:
 *
 * - `/search` pages against Firestore with a cursor, so it only needs the
 *   sentinel — the fetch itself is already incremental.
 * - `/favorites` and `/profile/listings` hold their full list in memory (both
 *   are bounded by what the user themselves saved or listed), so they window it
 *   client-side rather than issuing more reads.
 *
 * Both keep a visible "Load more" control alongside. Scroll-triggered loading
 * is invisible to keyboard and screen-reader users, and a list that can only be
 * advanced by scrolling is a list some people cannot finish.
 */

import * as React from 'react';

/** Products revealed per step, per the product brief. */
export const PAGE_STEP = 10;

interface InfiniteScrollOptions {
  /** False when everything has been shown — the observer then stops. */
  hasMore: boolean;
  /** True while a load is in flight, so we don't stack requests. */
  isLoading?: boolean;
  onLoadMore: () => void;
  /** How far ahead of the sentinel to start loading. */
  rootMargin?: string;
}

export function useInfiniteScroll({
  hasMore,
  isLoading = false,
  onLoadMore,
  rootMargin = '400px',
}: InfiniteScrollOptions) {
  // A *callback* ref held in state, not a plain useRef.
  //
  // The sentinel is not in the DOM on first render — the list is still showing
  // its loading skeleton. With a useRef the effect read `null`, and since its
  // dependencies (hasMore/isLoading) were unchanged by the time the sentinel
  // finally mounted, it never re-ran and no observer was ever attached: the
  // list only advanced via the button. Making the node itself a dependency ties
  // the observer to the element appearing.
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const sentinelRef = React.useCallback((el: HTMLDivElement | null) => setNode(el), []);

  // Keep the callback in a ref so re-creating it every render does not tear
  // down and rebuild the observer on each pass.
  const onLoadMoreRef = React.useRef(onLoadMore);
  React.useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  React.useEffect(() => {
    if (!node || !hasMore || isLoading) return;

    // Older browsers simply get the "Load more" button.
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) onLoadMoreRef.current();
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, hasMore, isLoading, rootMargin]);

  return { sentinelRef };
}

/**
 * Reveal an in-memory list a page at a time.
 *
 * The window resets whenever the list identity changes — applying a filter
 * should show the first page of the new results, not keep you scrolled deep
 * into a list that no longer exists.
 */
export function usePagedList<T>(items: T[] | null | undefined, step: number = PAGE_STEP) {
  const list = React.useMemo(() => items ?? [], [items]);
  const [visibleCount, setVisibleCount] = React.useState(step);

  // Reset on a genuinely different list. Length alone is a decent proxy and
  // avoids deep-comparing every product on each render.
  const resetKey = `${list.length}`;
  React.useEffect(() => { setVisibleCount(step); }, [resetKey, step]);

  const visible = React.useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount(c => Math.min(c + step, list.length));
  }, [step, list.length]);

  return { visible, hasMore, loadMore, total: list.length };
}
