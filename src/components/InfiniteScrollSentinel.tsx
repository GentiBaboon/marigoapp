'use client';

/**
 * The bottom-of-list affordance: an invisible sentinel that loads the next page
 * when scrolled into view, plus a real button doing the same thing.
 *
 * The button is not a fallback for old browsers — it is there so the list can
 * be advanced without scrolling at all, which is the only way keyboard and
 * screen-reader users can reach the end of an infinite list.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll, usePagedList, PAGE_STEP } from '@/hooks/use-infinite-scroll';

interface InfiniteScrollSentinelProps {
  /** Callback ref from useInfiniteScroll — attaches the observer on mount. */
  sentinelRef: (el: HTMLDivElement | null) => void;
  hasMore: boolean;
  isLoading?: boolean;
  onLoadMore: () => void;
  /** Shown once everything is on screen. Omit to show nothing. */
  endMessage?: string;
  loadMoreLabel?: string;
}

export function InfiniteScrollSentinel({
  sentinelRef,
  hasMore,
  isLoading = false,
  onLoadMore,
  endMessage,
  loadMoreLabel = 'Load more',
}: InfiniteScrollSentinelProps) {
  if (!hasMore) {
    return endMessage ? (
      <p className="py-8 text-center text-sm text-muted-foreground">{endMessage}</p>
    ) : null;
  }

  return (
    <>
      {/* Sits above the fold of the next page so loading starts before the
          visitor actually reaches the end. */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div className="flex justify-center py-8" aria-live="polite">
        {isLoading ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more…
          </span>
        ) : (
          <Button variant="outline" size="lg" className="rounded-full px-12" onClick={onLoadMore}>
            {loadMoreLabel}
          </Button>
        )}
      </div>
    </>
  );
}

interface PagedListProps<T> {
  items: T[];
  children: (item: T, index: number) => React.ReactNode;
  /** Classes for the wrapper around the rendered items. */
  className?: string;
  step?: number;
  endMessage?: string;
}

/**
 * A list already held in memory, revealed a page at a time.
 *
 * Use where the data arrives in one fetch and the cost of showing it is
 * rendering, not reading — a seller's own listings, a shopper's favourites.
 * Screens that page against Firestore should drive `InfiniteScrollSentinel`
 * from their own cursor instead, so scrolling fetches rather than unhides.
 */
export function PagedList<T>({
  items,
  children,
  className,
  step = PAGE_STEP,
  endMessage,
}: PagedListProps<T>) {
  const { visible, hasMore, loadMore } = usePagedList(items, step);
  const { sentinelRef } = useInfiniteScroll({ hasMore, onLoadMore: loadMore });

  return (
    <>
      <div className={className}>{visible.map((item, i) => children(item, i))}</div>
      <InfiniteScrollSentinel
        sentinelRef={sentinelRef}
        hasMore={hasMore}
        onLoadMore={loadMore}
        endMessage={endMessage}
      />
    </>
  );
}
