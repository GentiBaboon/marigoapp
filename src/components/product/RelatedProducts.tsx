'use client';

import * as React from 'react';
import { collection, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { ProductCard } from '@/components/product-card';
import {
  DEFAULT_RELATED_PRODUCTS_CONFIG,
  type FirestoreProduct,
  type FirestoreSettings,
  type RelatedProductsConfig,
} from '@/lib/types';

export function RelatedProducts({ product }: { product: FirestoreProduct }) {
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'global') : null),
    [firestore],
  );
  const { data: settings } = useDoc<FirestoreSettings>(settingsRef);
  const config: RelatedProductsConfig = {
    ...DEFAULT_RELATED_PRODUCTS_CONFIG,
    ...(settings?.relatedProducts || {}),
  };

  // Pick the field used to scope "related". Fall back gracefully if missing.
  const matchValue = React.useMemo(() => {
    if (config.matchBy === 'subcategory') return product.subcategoryId;
    if (config.matchBy === 'brand') return product.brandId;
    if (config.matchBy === 'gender') return product.gender;
    return undefined;
  }, [config.matchBy, product]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !config.enabled || !matchValue) return null;
    const constraints: any[] = [where('status', '==', 'active')];
    if (config.matchBy === 'subcategory') constraints.push(where('subcategoryId', '==', matchValue));
    if (config.matchBy === 'brand') constraints.push(where('brandId', '==', matchValue));
    if (config.matchBy === 'gender') constraints.push(where('gender', '==', matchValue));
    if (config.sameGender && config.matchBy !== 'gender' && product.gender) {
      constraints.push(where('gender', '==', product.gender));
    }
    constraints.push(orderBy('listingCreated', 'desc'));
    // Fetch a few extra so we can still hit `count` after filtering out the current item.
    constraints.push(limit(config.count + 4));
    return query(collection(firestore, 'products'), ...constraints);
  }, [
    firestore,
    config.enabled,
    config.matchBy,
    config.sameGender,
    config.count,
    matchValue,
    product.gender,
  ]);

  const { data: products, isLoading } = useCollection<FirestoreProduct>(productsQuery);

  const items = React.useMemo(() => {
    if (!products) return [];
    const filtered = products.filter((p) => p.id !== product.id);
    const sorted = [...filtered];
    if (config.sortBy === 'priceAsc') sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (config.sortBy === 'priceDesc') sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    return sorted.slice(0, config.count);
  }, [products, product.id, config.sortBy, config.count]);

  if (!config.enabled) return null;
  if (isLoading) return null;
  if (items.length === 0) return null;

  return (
    <section className="px-4 md:px-0 mt-12">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        You may also like
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
