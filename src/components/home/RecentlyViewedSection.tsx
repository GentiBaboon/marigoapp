'use client';

import * as React from 'react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import type { Product } from '@/lib/mock-data';
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
    )
}

export function RecentlyViewedSection() {
  const firestore = useFirestore();
  const [products, setProducts] = React.useState<FirestoreProduct[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [viewedIds, setViewedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    // This effect should only run on the client
    const savedIds = localStorage.getItem('marigo_recently_viewed');
    if (savedIds) {
      setViewedIds(JSON.parse(savedIds));
    } else {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (viewedIds.length === 0 || !firestore) {
        setIsLoading(false);
        return;
    };

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const productsCollection = collection(firestore, 'products');
        // Firestore 'in' query is limited to 10 items. We already slice to 6 on product page.
        const q = query(productsCollection, where(documentId(), 'in', viewedIds));
        const querySnapshot = await getDocs(q);
        const fetchedProducts: FirestoreProduct[] = [];
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
        });

        // The order from Firestore is not guaranteed, so we sort it based on our recently viewed order.
        const sortedProducts = fetchedProducts.sort((a, b) => viewedIds.indexOf(a.id) - viewedIds.indexOf(b.id));

        setProducts(sortedProducts);
      } catch (error) {
        console.error("Error fetching recently viewed products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [viewedIds, firestore]);

  if (isLoading) {
    return (
        <section>
            <h2 className="text-xl md:text-2xl font-serif mb-6">
              Recently Viewed
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
                {[...Array(3)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
        </section>
    );
  }
  
  if (products.length === 0) {
    return null; // Don't render the section if there are no items.
  }

  return (
    <section>
        <h2 className="text-xl md:text-2xl font-serif mb-6">
            Recently Viewed
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
            {products.map((p) => {
                const productForCard: Product = {
                    id: p.id,
                    brand: p.brand,
                    title: p.title,
                    price: p.price,
                    image: p.images?.[0]?.url || '',
                    sellerId: p.sellerId,
                    size: p.size,
                    condition: p.condition as any,
                    color: p.color,
                    vintage: p.vintage,
                };
                return <ProductCard key={p.id} product={productForCard} />;
            })}
        </div>
    </section>
  );
}
