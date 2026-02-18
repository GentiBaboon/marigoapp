'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type {
  FirestoreUser,
  FirestoreDelivery,
  FirestoreCourierProfile,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCheck, Clock, Truck } from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import LogisticsLoading from './loading';
import { CourierDataTable } from '@/components/admin/logistics/courier-table/data-table';
import { courierColumns } from '@/components/admin/logistics/courier-table/columns';

export type CourierData = FirestoreUser & {
  profile?: FirestoreCourierProfile;
};

export default function AdminLogisticsPage() {
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const [courierData, setCourierData] = React.useState<CourierData[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  // Fetch all deliveries
  const deliveriesQuery = useMemoFirebase(
    () => query(collection(firestore, 'deliveries')),
    [firestore]
  );
  const { data: deliveries, isLoading: deliveriesLoading } =
    useCollection<FirestoreDelivery>(deliveriesQuery);

  // Fetch users and their courier profiles
  React.useEffect(() => {
    if (!firestore) return;

    const fetchData = async () => {
      setIsDataLoading(true);
      const usersQuery = query(
        collection(firestore, 'users'),
        where('isCourier', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FirestoreUser)
      );

      const profilePromises = users.map((user) =>
        getDocs(
          query(collection(firestore, 'courier_profiles'), where('userId', '==', user.id))
        )
      );
      const profileSnapshots = await Promise.all(profilePromises);
      const profiles = profileSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCourierProfile)));

      const combinedData = users.map((user) => ({
        ...user,
        profile: profiles.find((p) => p.userId === user.id),
      }));

      setCourierData(combinedData);
      setIsDataLoading(false);
    };

    fetchData();
  }, [firestore]);
  
  const metrics = React.useMemo(() => {
    const pendingApprovals = courierData.filter(c => c.courierStatus === 'pending_approval').length;
    const activeCouriers = courierData.filter(c => c.courierStatus === 'approved' && c.profile?.isAvailable).length;
    const activeDeliveries = deliveries?.filter(d => !['delivered', 'cancelled'].includes(d.status)).length || 0;
    
    return { pendingApprovals, activeCouriers, activeDeliveries };
  }, [courierData, deliveries]);


  if (isDataLoading || deliveriesLoading) {
    return <LogisticsLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logistics</h1>
          <p className="text-muted-foreground">
            Manage couriers, deliveries, and logistics operations.
          </p>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending Approvals"
          value={metrics.pendingApprovals}
          icon={<Clock className="text-muted-foreground h-4 w-4" />}
          isLoading={isDataLoading}
        />
        <StatCard
          title="Active Couriers"
          value={metrics.activeCouriers}
          icon={<UserCheck className="text-muted-foreground h-4 w-4" />}
          isLoading={isDataLoading}
        />
        <StatCard
          title="Ongoing Deliveries"
          value={metrics.activeDeliveries}
          icon={<Truck className="text-muted-foreground h-4 w-4" />}
          isLoading={deliveriesLoading}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Courier Management</CardTitle>
            <CardDescription>Approve or reject new courier applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <CourierDataTable columns={courierColumns} data={courierData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Deliveries</CardTitle>
            <CardDescription>A real-time overview of all ongoing deliveries.</CardDescription>
          </CardHeader>
           <CardContent>
            <div data-ai-hint="logistics map" className="h-96 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
              Live map coming soon
            </div>
           </CardContent>
        </Card>
      </div>

    </div>
  );
}
