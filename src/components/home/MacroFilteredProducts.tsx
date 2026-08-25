'use client';

import * as React from 'react';
import { doc, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import type { MacroFiltersConfig } from '@/components/home/MacroFilters';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
import { ProductCard, toCardProduct } from '@/components/product-card';
import { PagedList } from '@/components/InfiniteScrollSentinel';
import { Skeleton } from '@/components/ui/skeleton';

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

/** Statuses a macro filter will display. Anything else — draft, pending_review,
 *  removed — is tagged but not yet public, so it is filtered out below. */
const DISPLAYABLE = ['active', 'reserved', 'sold'];

async function fetchProductsByIds(
  firestore: any,
  productIds: string[]
): Promise<FirestoreProduct[]> {
  if (productIds.length === 0) return [];

  // One `in` clause per query, and status filtered in memory afterwards.
  //
  // This used to combine `where(documentId(), 'in', batch)` with
  // `where('status', 'in', [...])`. Firestore caps a query's disjunctions at 30
  // and multiplies them, so a 24-id batch became 24 x 3 = 72 and the whole
  // query threw — which the caller's `.catch` turned into an empty rail. The
  // Preowned filter had 24 products tagged and rendered "No active products in
  // this filter yet", while New (6) and Designers (3) stayed under the cap and
  // looked fine. Any filter above 10 products was silently broken.
  const results: FirestoreProduct[] = [];
  const batches: string[][] = [];
  for (let i = 0; i < productIds.length; i += 30) {
    batches.push(productIds.slice(i, i + 30));
  }
  await Promise.all(
    batches.map(async (batch) => {
      const snap = await getDocs(
        query(collection(firestore, 'products'), where(documentId(), 'in', batch)),
      );
      snap.docs.forEach((d) => {
        const product = { id: d.id, ...d.data() } as FirestoreProduct;
        if (DISPLAYABLE.includes(product.status)) results.push(product);
      });
    })
  );

  // Restore the admin's ordering — Firestore returns documents by id, which
  // has nothing to do with the order they were curated in.
  const rank = new Map(productIds.map((id, i) => [id, i]));
  return results.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

interface Props {
  filterId: string;
}

export function MacroFilteredProducts({ filterId }: Props) {
  const firestore = useFirestore();
  const gender = useShoppingPreference();

  const filtersRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'macro_filters') : null),
    [firestore]
  );
  const { data: config, isLoading: configLoading } = useDoc<MacroFiltersConfig>(filtersRef);

  const [products, setProducts] = React.useState<FirestoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(true);

  const activeFilter = config?.filters?.find((f) => f.id === filterId);
  const productIds = activeFilter?.productIds ?? [];
  const label = activeFilter?.label ?? filterId;

  // stringify productIds to use as effect dep without unstable array reference
  const productIdsKey = productIds.join(',');

  React.useEffect(() => {
    if (configLoading) return;
    setProductsLoading(true);
    fetchProductsByIds(firestore, productIds)
      .then(setProducts)
      .catch((err) => {
        // Was a bare `setProducts([])`, which made a broken query and an empty
        // filter look identical — the reason this went unnoticed.
        console.error('[MacroFilteredProducts] failed to load products:', err);
        setProducts([]);
      })
      .finally(() => setProductsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, configLoading, productIdsKey]);

  // Apply the home-page shopping preference. We filter client-side because the
  // server query already uses two `in` filters (id + status) and Firestore caps
  // at one extra `in` clause; mixing 'in' + '==' is fine but per-row filtering
  // is simpler given the small result size.
  const visibleProducts = React.useMemo(
    () => (gender ? products.filter((p) => p.gender === gender || p.gender === 'unisex') : products),
    [products, gender],
  );

  const isLoading = configLoading || productsLoading;

  return (
    <section className="animate-in fade-in duration-500">
      <h2 className="text-xl md:text-2xl font-serif mb-6">{label}</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : visibleProducts.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No active products in this filter yet.
        </p>
      ) : (
        <PagedList items={visibleProducts} className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {(p) => (
            <ProductCard
              key={p.id}
              product={toCardProduct(p)}
            />
          )}
        </PagedList>
      )}
    </section>
  );
}
