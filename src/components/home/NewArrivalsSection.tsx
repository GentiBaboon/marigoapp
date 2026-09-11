'use client';

import * as React from 'react';
import { useHomepageProducts } from '@/components/home/HomepageProductsProvider';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
import { ProductCard, toCardProduct } from '@/components/product-card';
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

/** Cards on the rail. */
const RAIL_SIZE = 10;

export function NewArrivalsSection() {
  // Personalized feed: when the visitor picked a shopping preference, only
  // show products matching that gender. Unisex listings are included so they
  // don't disappear for either audience. Gender is applied client-side —
  // adding it to the Firestore query forces a composite index (gender + status
  // + listingCreated) we haven't deployed. The pool is shared with the other
  // homepage sections and already arrives newest first.
  const gender = useShoppingPreference();
  const { products: rawProducts, isLoading } = useHomepageProducts();
  const activeProducts = React.useMemo(
    () => (rawProducts
      ? rawProducts
          .filter(p => !gender || p.gender === gender || p.gender === 'unisex')
          .slice(0, RAIL_SIZE)
      : rawProducts),
    [rawProducts, gender],
  );

  if (!isLoading && (!activeProducts || activeProducts.length === 0)) {
    return null; // Hide the block if no active new products exist
  }

  return (
    <section>
        <h2 className="text-xl md:text-2xl font-serif mb-6">
            New In
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
                                    <ProductCard product={toCardProduct(p)} />
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
