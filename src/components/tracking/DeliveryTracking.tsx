'use client';

import * as React from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { FirestoreOrder, FirestoreDelivery, FirestoreUser } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MessageSquare } from 'lucide-react';
import { TrackingTimeline } from './TrackingTimeline';

interface DeliveryTrackingProps {
    order: FirestoreOrder;
    delivery: FirestoreDelivery;
}

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1
    ? `${names[0][0]}${names[names.length - 1][0]}`
    : name.substring(0, 2);
};

function CourierInfoCard({ courierId }: { courierId: string }) {
    const firestore = useFirestore();
    const courierRef = useMemoFirebase(() => doc(firestore, 'users', courierId), [firestore, courierId]);
    const { data: courier, isLoading } = useDoc<FirestoreUser>(courierRef);

    if (isLoading) {
        return (
            <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        )
    }

    if (!courier) return null;

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={courier.photoURL ?? undefined} alt={courier.displayName ?? 'Courier'} />
                    <AvatarFallback>{getInitials(courier.displayName)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{courier.displayName}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span>4.9</span>
                        <span className="text-xs">(128)</span>
                    </div>
                </div>
            </div>
             <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact
            </Button>
        </div>
    )
}


export function DeliveryTracking({ order, delivery }: DeliveryTrackingProps) {
    if (!delivery) return null;

    return (
        <div className="space-y-6">
            <div 
                data-ai-hint="map route"
                className="h-48 bg-muted rounded-lg flex items-center justify-center text-muted-foreground"
            >
                Map placeholder
            </div>
            
            {delivery.courierId && <CourierInfoCard courierId={delivery.courierId} />}
            
            <TrackingTimeline delivery={delivery} />
        </div>
    )
}
