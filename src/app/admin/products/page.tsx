
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { ProductService } from '@/services/product.service';
import { DataTable } from '@/components/admin/products/data-table';
import { columns } from '@/components/admin/products/columns';
import ProductsLoading from './loading';

export default function AdminProductsPage() {
  const firestore = useFirestore();
  const [sellerNames, setSellerNames] = React.useState<Record<string, string>>({});

  // Use the Service Layer to generate the query
  const productsQuery = useMemoFirebase(
    () => ProductService.getAllProductsQuery(firestore),
    [firestore]
  );

  const { data: products, isLoading: productsLoading } =
    useCollection<FirestoreProduct>(productsQuery);

  // Batch-fetch seller names once when products load (replaces N+1 per-row useDoc)
  React.useEffect(() => {
    if (!products || products.length === 0) return;

    const uniqueSellerIds = [...new Set(products.map(p => p.sellerId).filter(Boolean))];
    // Only fetch sellers we haven't fetched yet
    const missing = uniqueSellerIds.filter(id => !(id in sellerNames));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (sellerId) => {
        try {
          const snap = await getDoc(doc(firestore, 'users', sellerId));
          const data = snap.data() as FirestoreUser | undefined;
          return [sellerId, data?.name || 'Unknown Seller'] as const;
        } catch {
          return [sellerId, 'Unknown Seller'] as const;
        }
      })
    ).then((results) => {
      setSellerNames(prev => {
        const next = { ...prev };
        for (const [id, name] of results) next[id] = name;
        return next;
      });
    });
  }, [products, firestore]); // eslint-disable-line react-hooks/exhaustive-deps

  if (productsLoading) {
    return <ProductsLoading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          A centralized list of all marketplace inventory.
        </p>
      </div>
      <DataTable columns={columns} data={products || []} meta={{ sellerNames }} />
    </div>
  );
}
