'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { collection, query, where, getDocs, or } from 'firebase/firestore';

import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderItem } from '@/components/profile/order-item';

function OrdersSkeleton() {
    return (
        <div className="space-y-4">
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-24 w-24 rounded-md" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                </div>
            </div>
             <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-24 w-24 rounded-md" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ role }: { role: 'buyer' | 'seller' }) {
    return (
        <div className="text-center py-10">
            <h3 className="text-lg font-semibold">No orders found</h3>
            <p className="text-muted-foreground mt-2">
                {role === 'buyer' 
                    ? "You haven't bought any items yet." 
                    : "You haven't sold any items yet."}
            </p>
            {role === 'buyer' && (
                <Button asChild className="mt-4">
                    <Link href="/home">Start Shopping</Link>
                </Button>
            )}
        </div>
    )
}

function OrderList({ orders, role }: { orders: FirestoreOrder[], role: 'buyer' | 'seller' }) {
    if (orders.length === 0) {
        return <EmptyState role={role} />;
    }

    return (
        <div className="space-y-4">
            {orders.map(order => (
                <OrderItem key={order.id} order={order} userRole={role} />
            ))}
        </div>
    );
}


export default function OrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [buyingOrders, setBuyingOrders] = React.useState<FirestoreOrder[]>([]);
  const [sellingOrders, setSellingOrders] = React.useState<FirestoreOrder[]>([]);
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
            // Fetch buying orders
            const buyingQuery = query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
            const buyingSnapshot = await getDocs(buyingQuery);
            const buyingData = buyingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreOrder));
            setBuyingOrders(buyingData);

            // Fetch selling orders
            const sellingQuery = query(collection(firestore, 'orders'), where('sellerIds', 'array-contains', user.uid));
            const sellingSnapshot = await getDocs(sellingQuery);
            const sellingData = sellingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreOrder));
            setSellingOrders(sellingData);

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
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
            <div className="mb-4">
                 <Button asChild variant="outline">
                    <Link href="/profile">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Profile
                    </Link>
                 </Button>
            </div>
          <Card>
            <CardHeader>
              <CardTitle>My Orders</CardTitle>
              <CardDescription>
                Manage your buying and selling history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="buying" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="buying">Buying ({buyingOrders.length})</TabsTrigger>
                  <TabsTrigger value="selling">Selling ({sellingOrders.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="buying" className="mt-6">
                    {areDataLoading ? <OrdersSkeleton /> : 
                        <OrderList orders={buyingOrders} role="buyer" />
                    }
                </TabsContent>
                <TabsContent value="selling" className="mt-6">
                     {areDataLoading ? <OrdersSkeleton /> : 
                        <OrderList orders={sellingOrders} role="seller" />
                    }
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
