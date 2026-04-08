'use client';

import * as React from 'react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { Button } from '../ui/button';

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

export function NewArrivalsSection() {
  const firestore = useFirestore();

  // Filter active products server-side instead of fetching all and filtering on client
  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'products'),
      where('status', '==', 'active'),
      orderBy('listingCreated', 'desc'),
      limit(10)
    );
  }, [firestore]);

  const { data: activeProducts, isLoading } = useCollection<FirestoreProduct>(productsQuery);

  if (!isLoading && (!activeProducts || activeProducts.length === 0)) {
    return null; // Hide the block if no active new products exist
  }

  return (
    <section>
        <h2 className="text-xl md:text-2xl font-serif mb-6">
            New Arrivals
        </h2>

        {isLoading ? (
            <div className="flex space-x-4 pb-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-48 flex-shrink-0">
                        <ProductCardSkeleton />
                    </div>
                ))}
            </div>
        ) : (
             <>
                <ScrollArea>
                    <div className="flex space-x-4 pb-4">
                        {activeProducts?.map((p) => (
                                <div key={p.id} className="w-48 flex-shrink-0">
                                    <ProductCard product={{
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
                                    }} />
                                </div>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <div className="text-center mt-8">
                    <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="rounded-full px-12"
                    >
                        <Link href="/search?section=new-arrivals">View all</Link>
                    </Button>
                </div>
            </>
        )}
    </section>
  );
}
