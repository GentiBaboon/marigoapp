'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/lib/mock-data';
import * as React from 'react';

function NewArrivalsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-2 pt-1">
              <Skeleton className="h-4 w-2/4" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewArrivalsSection() {
  const firestore = useFirestore();
  const { user } = useUser();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query for 20 active products to have a buffer for client-side filtering
    return query(
      collection(firestore, 'products'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore]);

  const { data: products, isLoading } = useCollection<FirestoreProduct>(productsQuery);
  
  const filteredProducts = React.useMemo(() => {
    if (!products) return null;
    // If a user is logged in, filter out their own products. Otherwise, show all.
    const productList = user
      ? products.filter((p) => p.sellerId !== user.uid)
      : products;
    return productList.slice(0, 4); // Take the first 4 products
  }, [products, user]);


  if (isLoading) {
    return <NewArrivalsSkeleton />;
  }

  if (!filteredProducts || filteredProducts.length === 0) {
    return (
      <div className="text-center py-10 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No new arrivals at the moment. Check back later!</p>
      </div>
    );
  }
  
  // Adapt FirestoreProduct to Product for ProductCard
  const adaptedProducts: Product[] = filteredProducts.map(p => ({
      id: p.id,
      brand: p.brandId,
      title: p.title,
      price: p.price,
      originalPrice: p.originalPrice ?? undefined,
      image: p.images?.[0]?.url || '', // Use the actual image URL
  }));

  return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {adaptedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
      </div>
  );
}
