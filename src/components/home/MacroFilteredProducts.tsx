'use client';

import * as React from 'react';
import { doc, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import type { MacroFiltersConfig } from '@/components/home/MacroFilters';
import { ProductCard } from '@/components/product-card';
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

async function fetchProductsByIds(
  firestore: any,
  productIds: string[]
): Promise<FirestoreProduct[]> {
  if (productIds.length === 0) return [];
  // Firestore 'in' supports up to 30 values — batch if needed
  const results: FirestoreProduct[] = [];
  const batches = [];
  for (let i = 0; i < productIds.length; i += 30) {
    batches.push(productIds.slice(i, i + 30));
  }
  await Promise.all(
    batches.map(async (batch) => {
      const snap = await getDocs(
        query(
          collection(firestore, 'products'),
          where(documentId(), 'in', batch),
          where('status', 'in', ['active', 'reserved'])
        )
      );
      snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as FirestoreProduct));
    })
  );
  return results;
}

interface Props {
  filterId: string;
}

export function MacroFilteredProducts({ filterId }: Props) {
  const firestore = useFirestore();

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
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, configLoading, productIdsKey]);

  const isLoading = configLoading || productsLoading;

  return (
    <section className="animate-in fade-in duration-500">
      <h2 className="text-xl md:text-2xl font-serif mb-6">{label}</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No active products in this filter yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                brandId: p.brandId,
                title: p.title,
                price: p.price,
                images: p.images,
                sellerId: p.sellerId,
                size: p.size,
                condition: p.condition,
                color: p.color,
                vintage: p.vintage,
                status: p.status,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
