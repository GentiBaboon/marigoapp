'use client';

import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { DataTable } from '@/components/admin/products/data-table';
import { columns } from '@/components/admin/products/columns';
import ProductsLoading from './loading';

export default function AdminProductsPage() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(
    () => query(collection(firestore, 'products'), orderBy('listingCreated', 'desc')),
    [firestore]
  );
  const { data: products, isLoading: productsLoading } =
    useCollection<FirestoreProduct>(productsQuery);

  if (productsLoading) {
    return <ProductsLoading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          A list of all products in the marketplace.
        </p>
      </div>
      <DataTable columns={columns} data={products || []} />
    </div>
  );
}
