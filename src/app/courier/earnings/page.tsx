'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreDelivery } from '@/lib/types';
import { StatCard } from '@/components/admin/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CircleDollarSign, Calendar, Wallet } from 'lucide-react';
import { format } from 'date-fns';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

function DeliveryHistoryItem({ delivery }: { delivery: FirestoreDelivery }) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
                <p className="font-medium">Order #{delivery.orderId.slice(0, 8)}...</p>
                <p className="text-sm text-muted-foreground">
                    {delivery.status === 'delivered' ? 'Delivered on' : 'Cancelled on'}{' '}
                    {format(new Date(), 'MMM d, yyyy')} {/* Placeholder date */}
                </p>
            </div>
            <div className={`font-semibold ${delivery.status === 'cancelled' ? 'text-destructive' : 'text-green-600'}`}>
                {delivery.status === 'cancelled' ? '-' : '+'}
                {currencyFormatter.format(delivery.deliveryFee)}
            </div>
        </div>
    )
}


export default function CourierEarningsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    // Mock data for summary stats
    const summaryStats = {
        today: 25.50,
        week: 175.00,
        month: 680.75,
    };

    const deliveriesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'deliveries'),
            where('courierId', '==', user.uid),
            where('status', 'in', ['delivered', 'cancelled']),
            orderBy('status') // This is a bit arbitrary, would be better to order by completion date
        );
    }, [user, firestore]);
    
    const { data: deliveries, isLoading } = useCollection<FirestoreDelivery>(deliveriesQuery);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
                <p className="text-muted-foreground">
                    Track your earnings and request payouts.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard title="Today" value={currencyFormatter.format(summaryStats.today)} icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="This Week" value={currencyFormatter.format(summaryStats.week)} icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="This Month" value={currencyFormatter.format(summaryStats.month)} icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Earnings Chart (Last 30d)</CardTitle>
                </CardHeader>
                <CardContent className="h-60 flex items-center justify-center text-muted-foreground bg-muted/50 rounded-md">
                     Chart coming soon.
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Delivery History</CardTitle>
                        <CardDescription>Your recent completed or cancelled deliveries.</CardDescription>
                    </div>
                     <Button disabled>
                        <Wallet className="mr-2 h-4 w-4" />
                        Request Payout
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : deliveries && deliveries.length > 0 ? (
                        <div className="divide-y">
                            {deliveries.map(d => <DeliveryHistoryItem key={d.id} delivery={d} />)}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No delivery history yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
