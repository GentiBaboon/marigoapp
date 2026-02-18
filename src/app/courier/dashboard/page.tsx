'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatCard } from '@/components/admin/stat-card';
import { AvailabilityToggle } from '@/components/courier/AvailabilityToggle';
import { Truck, CircleDollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { FirestoreDelivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ActiveDeliveryCard } from '@/components/courier/ActiveDeliveryCard';

export default function CourierDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Query for active deliveries
  const activeDeliveryQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('courierId', '==', user.uid),
      where('status', 'in', [
        'assigned',
        'arrived_for_pickup',
        'picked_up',
        'in_transit',
        'arrived_for_delivery',
      ])
    );
  }, [user, firestore]);

  const { data: activeDeliveries, isLoading } =
    useCollection<FirestoreDelivery>(activeDeliveryQuery);

  const activeDelivery = activeDeliveries?.[0];

  // These would come from state or props in a real app
  const todayStats = {
    deliveries: 3,
    earnings: 25.5,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Courier Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your availability and track your deliveries.
          </p>
        </div>
        <AvailabilityToggle />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Deliveries Completed"
            value={todayStats.deliveries}
            icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            title="Earnings Today"
            value={`€${todayStats.earnings.toFixed(2)}`}
            icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : activeDelivery ? (
        <ActiveDeliveryCard delivery={activeDelivery} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Active Delivery
            </CardTitle>
            <CardDescription>
              You do not have an active delivery. Available jobs will appear on
              the jobs board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/courier/jobs">Go to Jobs Board</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
