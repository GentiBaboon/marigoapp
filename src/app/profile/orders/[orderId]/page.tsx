'use client';
import * as React from 'react';
import Link from 'next/link';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import type { FirestoreOrder, FirestoreDelivery } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpCircle, PackageCheck } from 'lucide-react';
import Image from 'next/image';
import { OrderTimeline } from '@/components/profile/order-timeline';
import { useParams } from 'next/navigation';
import { DeliveryTracking } from '@/components/tracking/DeliveryTracking';

function OrderDetailsSkeleton() {
    return (
        <div className="p-4 space-y-6 bg-muted/40 min-h-screen">
            <div className="p-4 bg-background rounded-md">
                <Skeleton className="h-6 w-32 mb-2" />
                <div className="flex gap-4 items-center">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                </div>
            </div>
            <div className="p-4 bg-background rounded-md">
                <div className="space-y-8 mt-4">
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-4 rounded-full mt-1" />
                        <div className="space-y-1 flex-1">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-4 rounded-full mt-1" />
                        <div className="space-y-1 flex-1">
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default function OrderDetailsPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const firestore = useFirestore();

    const orderRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isOrderLoading } = useDoc<FirestoreOrder>(orderRef);
    
    const deliveryQuery = useMemoFirebase(() => {
        if (!firestore || !orderId) return null;
        return query(collection(firestore, 'deliveries'), where('orderId', '==', orderId), limit(1));
    }, [firestore, orderId]);
    const { data: deliveries, isLoading: isDeliveryLoading } = useCollection<FirestoreDelivery>(deliveryQuery);
    const delivery = deliveries?.[0];

    const isLoading = isOrderLoading || isDeliveryLoading;
    
    if (isLoading) {
        return <OrderDetailsSkeleton />;
    }
    
    if (!order) {
        return (
             <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
                 <h1 className="text-xl font-bold">Order Not Found</h1>
                 <p className="mt-2 text-muted-foreground">This order could not be found.</p>
                 <Button asChild variant="link" className="mt-4">
                    <Link href="/profile/orders">Back to Orders</Link>
                </Button>
            </div>
        )
    }

    const item = order.items[0];
    const displayTitle = item.title;

    return (
        <div className="bg-muted/40 min-h-screen">
            <main className="p-4 space-y-4">
                 <div className="bg-background p-4 rounded-lg">
                    <h1 className="font-semibold text-lg mb-4">Ref #{order.orderNumber}</h1>
                    <div className="flex gap-4 items-center">
                        <div className="relative h-16 w-16 rounded-md bg-muted flex-shrink-0">
                            <Image src={item.image} alt={displayTitle} fill className="object-cover rounded-md" sizes="64px" />
                        </div>
                        <div>
                            <p className="font-bold text-lg uppercase">{item.brand}</p>
                            <p>{displayTitle}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <PackageCheck className="h-4 w-4" />
                                Direct Shipping
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-background p-4 rounded-lg">
                    {delivery ? (
                        <DeliveryTracking order={order} delivery={delivery} />
                    ) : (
                        <OrderTimeline order={order} />
                    )}
                </div>
                
                <div className="pt-8">
                     <Button variant="outline" className="w-full bg-background">
                        <HelpCircle className="mr-2 h-4 w-4"/>
                        Help center
                    </Button>
                </div>
            </main>
        </div>
    );
}
