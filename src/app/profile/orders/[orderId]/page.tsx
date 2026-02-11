'use client';
import * as React from 'react';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { FirestoreOrder } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Truck, Package, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { OrderTimeline } from '@/components/profile/order-timeline';
import { ReviewForm } from '@/components/profile/review-form';
import { useToast } from '@/hooks/use-toast';

const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

const DetailRow = ({ label, value, children }: { label: string; value?: React.ReactNode, children?: React.ReactNode }) => (
    <div className="flex justify-between items-start">
        <p className="text-muted-foreground">{label}</p>
        <div className="font-medium text-right">{value || children}</div>
    </div>
);

function OrderDetailsSkeleton() {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                         <Skeleton className="h-24 w-24 rounded-md" />
                         <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-4 w-1/4" />
                         </div>
                    </div>
                     <Separator />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                     </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function OrderDetailsPage({ params }: { params: { orderId: string } }) {
    const { orderId } = params;
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const orderRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isOrderLoading } = useDoc<FirestoreOrder>(orderRef);

    const userRole = order?.buyerId === user?.uid ? 'buyer' : 'seller';
    const isLoading = isUserLoading || isOrderLoading;
    
    const handleUpdateStatus = async (newStatus: string) => {
        if (!orderRef) return;
        try {
            await updateDoc(orderRef, { status: newStatus });
            toast({ title: "Order Updated", description: `Order status changed to ${newStatus}.`});
        } catch (error) {
             console.error("Error updating order status:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus },
            }));
            toast({ variant: "destructive", title: "Error", description: "Failed to update order status."});
        }
    }


    if (isLoading) {
        return (
             <div className="container mx-auto py-8 px-4 max-w-3xl">
                <OrderDetailsSkeleton />
            </div>
        );
    }
    
    if (!order) {
        return (
             <div className="container mx-auto py-8 px-4 max-w-3xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Order Not Found</CardTitle>
                        <CardDescription>This order could not be found. It may have been deleted or you may not have permission to view it.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    const { shippingAddress, items } = order;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="icon">
                    <Link href="/profile/orders">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    </Button>
                    <div>
                    <h1 className="text-2xl font-bold">Order Details</h1>
                    <p className="text-muted-foreground">
                        Order #{order.orderNumber} &bull; {format(new Date(order.createdAt.seconds * 1000), 'PPP')}
                    </p>
                    </div>
                </div>

                <OrderTimeline status={order.status} />

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {items.map((item, index) => (
                             <React.Fragment key={item.productId}>
                                <div className="flex gap-4">
                                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                        <Image src={item.image} alt={item.title} fill className="object-cover" sizes="80px" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">{item.brand}</p>
                                        <h3 className="font-semibold">{item.title}</h3>
                                        <p className="text-sm">{currencyFormatter(item.price)}</p>
                                    </div>
                                </div>
                                {index < items.length - 1 && <Separator />}
                             </React.Fragment>
                        ))}
                    </CardContent>
                </Card>
                
                {userRole === 'buyer' && (
                     <Card>
                        <CardHeader>
                            <CardTitle>Shipping Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <p className="font-medium">{shippingAddress.fullName}</p>
                           <p className="text-muted-foreground">{shippingAddress.address}</p>
                           <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.postal}, {shippingAddress.country}</p>
                           <p className="text-muted-foreground">{shippingAddress.phone}</p>
                        </CardContent>
                    </Card>
                )}

                 <Card>
                    <CardHeader>
                        <CardTitle>Payment Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <DetailRow label="Products price" value={currencyFormatter(order.itemsPrice)} />
                        <DetailRow label="Authentication" value={currencyFormatter(order.authenticationPrice)} />
                        <DetailRow label="Shipping" value={currencyFormatter(order.shippingPrice)} />
                         <Separator className="my-2" />
                        <DetailRow label="Total">
                            <p className="font-bold text-lg">{currencyFormatter(order.totalAmount)}</p>
                        </DetailRow>
                    </CardContent>
                 </Card>
                 
                {userRole === 'seller' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Fulfillment</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div>
                                <h4 className="font-semibold">Shipping to:</h4>
                               <p>{shippingAddress.fullName}, {shippingAddress.address}, {shippingAddress.city}</p>
                            </div>
                            <Button className="w-full" disabled={order.status !== 'processing'} onClick={() => handleUpdateStatus('shipped')}>
                                <Truck className="mr-2 h-4 w-4"/>
                                Confirm Shipment
                            </Button>
                        </CardContent>
                    </Card>
                )}
                 
                 {userRole === 'buyer' && order.status === 'delivered' && (
                    <Card id="review">
                        <CardHeader>
                            <CardTitle>Leave a Review</CardTitle>
                            <CardDescription>Share your experience with the seller.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ReviewForm order={order} />
                        </CardContent>
                    </Card>
                 )}

            </div>
        </div>
    );
}
