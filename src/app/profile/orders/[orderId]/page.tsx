'use client';
import * as React from 'react';
import Link from 'next/link';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { FirestoreOrder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, HelpCircle, PackageCheck } from 'lucide-react';
import Image from 'next/image';
import { OrderTimeline } from '@/components/profile/order-timeline';

function OrderDetailsSkeleton() {
    return (
        <div className="p-4 space-y-6 bg-muted/40 min-h-screen">
            <header className="flex items-center justify-between bg-background p-2 rounded-md">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-6 w-32" />
                <div className="w-10"></div>
            </header>
            <div className="p-4 bg-background rounded-md">
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


export default function OrderDetailsPage({ params }: { params: { orderId: string } }) {
    const { orderId } = params;
    const firestore = useFirestore();

    const orderRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading } = useDoc<FirestoreOrder>(orderRef);
    
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

    return (
        <div className="bg-muted/40 min-h-screen">
            <header className="sticky top-0 z-10 flex items-center justify-between bg-background p-2 md:p-4 border-b">
                <Button asChild variant="ghost" size="icon">
                    <Link href="/profile/orders">
                        <ArrowLeft className="h-6 w-6" />
                    </Link>
                </Button>
                <h1 className="font-semibold text-lg">Ref #{order.orderNumber}</h1>
                {/* Placeholder for right side icon to balance layout */}
                <div className="w-10"></div>
            </header>

            <main className="p-4 space-y-4">
                <div className="bg-background p-4 rounded-lg">
                    <div className="flex gap-4 items-center">
                        <div className="relative h-16 w-16 rounded-md bg-muted flex-shrink-0">
                            <Image src={item.image} alt={item.title} fill className="object-cover rounded-md" sizes="64px" />
                        </div>
                        <div>
                            <p className="font-bold text-lg uppercase">{item.brand}</p>
                            <p>{item.title}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <PackageCheck className="h-4 w-4" />
                                Direct Shipping
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-background p-4 rounded-lg">
                    <OrderTimeline order={order} />
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
