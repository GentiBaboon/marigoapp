'use client';

/**
 * "Last Viewed" — the products this shopper has opened, newest first.
 *
 * History comes from `useRecentlyViewedIds`, which merges the device's local
 * copy with the one stored on the user document. Before that hook existed this
 * section read a localStorage key that **nothing ever wrote**, so it never had
 * anything to show.
 */

import * as React from 'react';
import { useFirestore } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { PagedList } from '@/components/InfiniteScrollSentinel';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentlyViewedIds } from '@/hooks/use-recently-viewed';
import { fetchProductsByIds } from '@/components/home/FavoritesSection';

function ProductCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
}

interface RecentlyViewedSectionProps {
  /**
   * Product to leave out — the one currently on screen. Without this the
   * product page lists the item you are already looking at, which it always
   * would: opening it is what put it at the top of the history.
   */
  excludeId?: string;
  title?: string;
}

export function RecentlyViewedSection({ excludeId, title = 'Last Viewed' }: RecentlyViewedSectionProps = {}) {
  const firestore = useFirestore();
  const { ids: allIds, isLoading: isHistoryLoading } = useRecentlyViewedIds();
  const ids = React.useMemo(
    () => (excludeId ? allIds.filter(id => id !== excludeId) : allIds),
    [allIds, excludeId],
  );

  const [products, setProducts] = React.useState<FirestoreProduct[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const idKey = ids.join(',');

  React.useEffect(() => {
    if (!firestore || isHistoryLoading) return;
    if (ids.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchProductsByIds(firestore, ids)
      .then(found => { if (!cancelled) setProducts(found); })
      .catch(err => console.warn('recently viewed section failed:', err))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
    // `idKey` stands in for `ids` so the effect compares contents, not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, isHistoryLoading, idKey]);

  // No history yet is the normal state for a first visit, not an error.
  if (!isLoading && products.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl md:text-2xl font-serif mb-6">{title}</h2>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : (
        <PagedList items={products} className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {p => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                brandId: p.brandId,
                title: p.title,
                price: p.price,
                originalPrice: p.originalPrice,
                images: p.images,
                sellerId: p.sellerId,
                size: p.size,
                condition: p.condition,
                color: p.color,
                vintage: p.vintage,
                status: p.status,
              }}
            />
          )}
        </PagedList>
      )}
    </section>
  );
}
