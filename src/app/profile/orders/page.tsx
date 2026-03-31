
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreOrder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OrderItem } from '@/components/profile/order-item';
import { ShoppingBag } from 'lucide-react';

function OrdersSkeleton() {
    return (
        <div className="space-y-4 px-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="py-4 border-b">
                    <div className="flex justify-between items-center mb-3">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="flex-1 space-y-2">
                             <Skeleton className="h-5 w-20" />
                             <Skeleton className="h-4 w-32" />
                             <Skeleton className="h-4 w-28" />
                        </div>
                         <Skeleton className="h-6 w-6" />
                    </div>
                    <Skeleton className="h-6 w-36" />
                </div>
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-20 px-4">
            <div className="bg-muted/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-headline">No orders yet</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                Items you buy will appear here. Start exploring our curated selection!
            </p>
            <Button asChild className="mt-8 rounded-full px-8">
                <Link href="/home">Start Shopping</Link>
            </Button>
        </div>
    )
}

export default function OrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'orders'),
        where('buyerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: rawOrders, isLoading: areOrdersLoading } = useCollection<FirestoreOrder>(ordersQuery);
  const orders = React.useMemo(() => {
    if (!rawOrders) return rawOrders;
    return [...rawOrders].sort((a, b) => {
      const getMs = (ts: any) => {
        if (!ts) return 0;
        if (typeof ts === 'string') return new Date(ts).getTime();
        if (typeof ts === 'object' && 'seconds' in ts) return ts.seconds * 1000;
        if (ts?.toMillis) return ts.toMillis();
        return 0;
      };
      return getMs(b.createdAt) - getMs(a.createdAt);
    });
  }, [rawOrders]);

  if (!user && !isUserLoading) {
     return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>My Orders</CardTitle>
              <CardDescription>
                Please sign in to view your orders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/auth">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
    );
  }

  return (
     <div className="container mx-auto max-w-lg p-0 md:p-4">
        <div className="px-4 pt-8 md:pt-4">
            <h1 className="text-3xl font-bold font-headline">My Orders</h1>
            <p className="text-muted-foreground">Track and manage your purchases.</p>
        </div>

        <div className="mt-8">
            {areOrdersLoading ? (
                <OrdersSkeleton />
            ) : orders && orders.length > 0 ? (
                <div className="px-4 md:px-0 divide-y">
                    {orders.map(order => (
                        <OrderItem key={order.id} order={order} />
                    ))}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    </div>
  );
}
