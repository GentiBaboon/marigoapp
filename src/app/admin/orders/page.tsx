'use client';

import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreOrder } from '@/lib/types';
import { DataTable } from '@/components/admin/orders/data-table';
import { columns } from '@/components/admin/orders/columns';
import OrdersLoading from './loading';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AdminOrdersPage() {
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(
    () => query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: orders, isLoading: ordersLoading } =
    useCollection<FirestoreOrder>(ordersQuery);

  if (ordersLoading) {
    return <OrdersLoading />;
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
                <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
                <p className="text-muted-foreground">
                    Manage and track all customer orders.
                </p>
            </div>
        </div>
      <DataTable columns={columns} data={orders || []} />
    </div>
  );
}
