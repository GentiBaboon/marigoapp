'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, User, HelpCircle } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { useUser, useFirestore } from '@/firebase';
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
  const firestore = useFirestore();
  const [orders, setOrders] = React.useState<FirestoreOrder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !firestore) {
        if (!isUserLoading) {
            setIsLoading(false);
        }
        return;
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const ordersQuery = query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
            const querySnapshot = await getDocs(ordersQuery);
            const fetchedOrders = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as FirestoreOrder))
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds); // Sort by newest first
            setOrders(fetchedOrders);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchOrders();

  }, [user, firestore, isUserLoading]);

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
     <div className="container mx-auto max-w-lg p-0">
        <div className="flex items-center justify-between p-2 md:p-4 border-b bg-background sticky top-16 md:top-0 z-10">
            <Button variant="ghost" size="icon" asChild>
                <Link href="/profile">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
            </Button>
            <h1 className="text-xl font-bold">Orders</h1>
            <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/profile">
                         <User className="h-6 w-6" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                     <Link href="/help">
                        <HelpCircle className="h-6 w-6" />
                    </Link>
                </Button>
            </div>
        </div>

        <div>
            {areDataLoading ? (
                <OrdersSkeleton />
            ) : orders.length > 0 ? (
                <div className="px-4">
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
