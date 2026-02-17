'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { DataTable } from '@/components/admin/users/data-table';
import { columns } from '@/components/admin/products/columns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ModerationQueue } from '@/components/admin/products/moderation-queue';
import ProductsLoading from './loading';

export default function AdminProductsPage() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(
    () => query(collection(firestore, 'products'), orderBy('listingCreated', 'desc')),
    [firestore]
  );
  const { data: products, isLoading: productsLoading } =
    useCollection<FirestoreProduct>(productsQuery);

  const pendingReviewProducts = useMemo(() => {
    return products?.filter(p => p.status === 'pending_review') || [];
  }, [products]);

  if (productsLoading) {
    return <ProductsLoading />;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Moderate and manage product listings.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="queue">
        <TabsList className="grid grid-cols-2 max-w-sm">
            <TabsTrigger value="queue">
                Moderation Queue 
                {pendingReviewProducts.length > 0 && <span className="ml-2 bg-primary text-primary-foreground h-5 w-5 text-xs rounded-full flex items-center justify-center">{pendingReviewProducts.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="all">All Products</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
            <Card>
                <CardHeader>
                    <CardTitle>Pending Review</CardTitle>
                    <CardDescription>Approve or reject products waiting for moderation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ModerationQueue products={pendingReviewProducts} />
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="all">
            <DataTable columns={columns} data={products || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
