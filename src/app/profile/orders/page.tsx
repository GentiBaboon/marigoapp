'use client';

import * as React from 'react';
import Link from 'next/link';
import { User, HelpCircle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { useUser } from '@/firebase';
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
        <div className="text-center py-20">
            <h3 className="text-lg font-semibold">No orders yet</h3>
            <p className="text-muted-foreground mt-2">
                You haven't bought any items yet.
            </p>
            <Button asChild className="mt-4">
                <Link href="/home">Start Shopping</Link>
            </Button>
        </div>
    )
}

export default function OrdersPage() {
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = React.useState<FirestoreOrder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isUserLoading) {
        return;
    }
    if (!user) {
        setIsLoading(false);
        return;
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const functions = getFunctions();
            const getMyOrders = httpsCallable(functions, 'getMyOrders');
            const result: any = await getMyOrders();
            setOrders(result.data.orders);
        } catch (error) {
            console.error("Error fetching orders via Cloud Function:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchOrders();

  }, [user, isUserLoading]);

  const areDataLoading = isUserLoading || isLoading;
  
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
        <div className="px-4 pt-4 md:pt-0">
            <h1 className="text-2xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">Track and manage your purchases.</p>
        </div>

        <div className="mt-4">
            {areDataLoading ? (
                <OrdersSkeleton />
            ) : orders.length > 0 ? (
                <div className="px-4 md:px-0">
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
