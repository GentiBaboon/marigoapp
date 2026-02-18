'use client';
import * as React from 'react';
import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import type { FirestoreOrder, FirestoreAddress, FirestoreDelivery } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageCheck, Copy } from 'lucide-react';
import Image from 'next/image';
import { SellerOrderTimeline } from '@/components/profile/seller-order-timeline';
import { useParams } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { DeliveryTracking } from '@/components/tracking/DeliveryTracking';

function SaleDetailsSkeleton() {
    return (
        <div className="p-4 space-y-6 bg-muted/40 min-h-screen">
            <div className="p-4 bg-background rounded-lg">
                 <div className="flex gap-4 items-center">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                </div>
            </div>
            <Skeleton className="h-12 w-full" />
            <div className="p-4 bg-background rounded-lg">
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
                            <Skeleton className="h-40 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SaleDetailsPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const orderRef = useMemoFirebase(() => {
        if (!firestore || !orderId) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);
    const { data: order, isLoading: isOrderLoading } = useDoc<FirestoreOrder>(orderRef);

    const addressesCollection = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'addresses');
    }, [user, firestore]);
    const { data: addresses, isLoading: areAddressesLoading } = useCollection<FirestoreAddress>(addressesCollection);

    const deliveryQuery = useMemoFirebase(() => {
        if (!firestore || !orderId) return null;
        return query(collection(firestore, 'deliveries'), where('orderId', '==', orderId), limit(1));
    }, [firestore, orderId]);
    const { data: deliveries, isLoading: isDeliveryLoading } = useCollection<FirestoreDelivery>(deliveryQuery);
    const delivery = deliveries?.[0];

    const isLoading = isUserLoading || isOrderLoading || areAddressesLoading || isDeliveryLoading;

    if (isLoading) {
        return <SaleDetailsSkeleton />;
    }
    
    if (!order) {
        return (
             <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
                 <h1 className="text-xl font-bold">Sale Not Found</h1>
                 <p className="mt-2 text-muted-foreground">This sale could not be found.</p>
                 <Button asChild variant="link" className="mt-4">
                    <Link href="/profile/listings">Back to Listings</Link>
                </Button>
            </div>
        )
    }

    const item = order.items[0];
    const estimatedPaymentDate = addDays(new Date(order.createdAt.seconds * 1000), 10); // Placeholder logic
    const shippingFromAddress = addresses?.find(a => a.isDefault) || addresses?.[0];

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied to clipboard!' });
        });
    }

    return (
        <div className="bg-muted/40 min-h-screen">
            <main className="p-4 space-y-4">
                 <div className="bg-background p-4 rounded-lg">
                    <div className="flex gap-4 items-center">
                        <div className="relative h-16 w-16 rounded-md bg-muted flex-shrink-0">
                            <Image src={item.image} alt={item.title.en} fill className="object-cover rounded-md" sizes="64px" />
                        </div>
                        <div>
                            <p className="font-bold text-lg uppercase">{item.brand}</p>
                            <p>{item.title.en}</p>
                             <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                Ref. {item.productId.slice(0, 8)}
                                <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(item.productId)} />
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <PackageCheck className="h-4 w-4" />
                                Direct Shipping
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-background p-4 rounded-lg text-center">
                    <p className="text-sm uppercase text-muted-foreground tracking-wider">Estimated Payment</p>
                    <p className="font-semibold text-lg">{format(estimatedPaymentDate, 'MMMM d, yyyy')}</p>
                </div>

                <div className="bg-background p-4 rounded-lg">
                    {delivery ? (
                        <DeliveryTracking order={order} delivery={delivery} />
                    ) : shippingFromAddress ? (
                        <SellerOrderTimeline order={order} shippingFromAddress={shippingFromAddress} />
                    ) : (
                        <p className="text-center text-muted-foreground">Waiting for shipping details...</p>
                    )}
                </div>
            </main>
        </div>
    );
}
