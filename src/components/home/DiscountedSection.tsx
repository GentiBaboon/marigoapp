'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard, toCardProduct } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Half-price rail: listings marked down by at least this much against their
 * original price. 49 rather than 50 so an item at exactly "half off" still
 * qualifies after rounding (79 → 160 is 50.6%, but 35 → 69 is 49.3%).
 */
const MIN_DISCOUNT_PCT = 49;

/** Rows pulled before filtering. Discount is computed per item, so Firestore
 *  cannot pre-filter it; this pool is what we search through. */
const POOL_SIZE = 100;

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

/** Percentage off, or null when the listing has no usable original price. */
export function discountPercent(product: Pick<FirestoreProduct, 'price' | 'originalPrice'>): number | null {
  const { price, originalPrice } = product;
  if (typeof originalPrice !== 'number' || originalPrice <= 0) return null;
  if (typeof price !== 'number' || price <= 0) return null;
  if (price >= originalPrice) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export function DiscountedSection() {
  const firestore = useFirestore();
  const gender = useShoppingPreference();

  // Sold items are excluded: a markdown rail exists to be shopped, and a
  // half-price listing you cannot buy is worse than one fewer card.
  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'products'),
      where('status', 'in', ['active', 'reserved']),
      orderBy('listingCreated', 'desc'),
      limit(POOL_SIZE),
    );
  }, [firestore]);

  const { data: rawProducts, isLoading } = useCollection<FirestoreProduct>(productsQuery);

  const products = React.useMemo(() => {
    return (rawProducts ?? [])
      .filter(p => !gender || p.gender === gender || p.gender === 'unisex')
      .map(p => ({ product: p, discount: discountPercent(p) }))
      .filter((e): e is { product: FirestoreProduct; discount: number } =>
        e.discount !== null && e.discount >= MIN_DISCOUNT_PCT)
      // Deepest markdown first — that is the reason to look at this rail.
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 8)
      .map(e => e.product);
  }, [rawProducts, gender]);

  // Nothing marked down right now is a normal state, not an error state.
  if (!isLoading && products.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl md:text-2xl font-serif mb-6">50% OFF Preloved</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
          {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
            {products.map(p => (
              <ProductCard
                key={p.id}
                product={toCardProduct(p)}
              />
            ))}
          </div>
          <div className="text-center mt-8">
            <Button asChild size="lg" variant="outline" className="rounded-full px-12">
              <Link href="/search?section=sale">View all</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
