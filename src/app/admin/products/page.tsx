
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { ProductService } from '@/services/product.service';
import { DataTable } from '@/components/admin/products/data-table';
import { columns } from '@/components/admin/products/columns';
import ProductsLoading from './loading';

export default function AdminProductsPage() {
  const firestore = useFirestore();

  // Use the Service Layer to generate the query
  const productsQuery = useMemoFirebase(
    () => ProductService.getAllProductsQuery(firestore),
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
          A centralized list of all marketplace inventory.
        </p>
      </div>
      <DataTable columns={columns} data={products || []} />
    </div>
  );
}
