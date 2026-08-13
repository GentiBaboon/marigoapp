'use client';

/**
 * "Your Favorites" on the homepage — everything the shopper has hearted.
 *
 * Personal to the signed-in user, so it renders nothing at all when signed
 * out: an empty rail promising favourites to someone with no account is just
 * a dead heading.
 */

import * as React from 'react';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useWishlist } from '@/context/WishlistContext';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { PagedList } from '@/components/InfiniteScrollSentinel';
import { Skeleton } from '@/components/ui/skeleton';

/** Firestore caps an `in` filter at 10 values, so ids are fetched in batches. */
const IN_QUERY_LIMIT = 10;

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

/**
 * Fetch products by id, in batches of ten.
 *
 * Shared by the two personal rails. Order is restored from `ids` afterwards:
 * Firestore returns documents in its own order, but "most recently favourited"
 * and "most recently viewed" are only meaningful in the caller's order.
 */
export async function fetchProductsByIds(
  firestore: NonNullable<ReturnType<typeof useFirestore>>,
  ids: string[],
): Promise<FirestoreProduct[]> {
  if (ids.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    batches.push(ids.slice(i, i + IN_QUERY_LIMIT));
  }

  const snapshots = await Promise.all(
    batches.map(batch =>
      getDocs(query(collection(firestore, 'products'), where(documentId(), 'in', batch))),
    ),
  );

  const found = new Map<string, FirestoreProduct>();
  snapshots.forEach(snap => {
    snap.docs.forEach(d => found.set(d.id, { id: d.id, ...d.data() } as FirestoreProduct));
  });

  // Preserve the caller's order, and silently drop ids whose product has since
  // been deleted or unpublished.
  return ids.map(id => found.get(id)).filter((p): p is FirestoreProduct => !!p);
}

export function FavoritesSection() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { wishlistItems, isLoading: isWishlistLoading } = useWishlist();

  const [products, setProducts] = React.useState<FirestoreProduct[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const ids = React.useMemo(() => wishlistItems.map(i => i.id), [wishlistItems]);
  const idKey = ids.join(',');

  React.useEffect(() => {
    if (!firestore || !user || isWishlistLoading) return;
    if (ids.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchProductsByIds(firestore, ids)
      .then(found => { if (!cancelled) setProducts(found); })
      .catch(err => console.warn('favorites section failed:', err))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, user, isWishlistLoading, idKey]);

  if (!user) return null;
  if (!isLoading && products.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl md:text-2xl font-serif mb-6">Your Favorites</h2>
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
