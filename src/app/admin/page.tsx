'use client';
import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import type {
  FirestoreUser,
  FirestoreProduct,
  FirestoreOrder,
} from '@/lib/types';

import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  PackageCheck,
  PackageX,
  Star,
  FileBarChart,
  BadgePercent,
  CalendarClock
} from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { RevenueChart } from '@/components/admin/charts/revenue-chart';
import { UsersChart } from '@/components/admin/charts/users-chart';
import { subDays } from 'date-fns';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const COMMISSION_RATE = 0.15;

export default function AdminDashboardPage() {
  const firestore = useFirestore();

  // Data Fetching
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<FirestoreUser>(usersQuery);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: productsLoading } = useCollection<FirestoreProduct>(productsQuery);

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: orders, isLoading: ordersLoading } = useCollection<FirestoreOrder>(ordersQuery);

  // Memoized Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const safeUsers = users || [];
    const safeProducts = products || [];
    const safeOrders = orders || [];

    const totalUsers = safeUsers.length;
    const newUsers = safeUsers.filter(u => u.createdAt?.toDate() > thirtyDaysAgo).length;

    const totalProducts = safeProducts.length;
    const activeListings = safeProducts.filter(p => p.status === 'active').length;
    const soldItems = safeProducts.filter(p => p.status === 'sold').length;

    const totalOrders = safeOrders.length;
    const ordersThisMonth = safeOrders.filter(o => o.createdAt?.toDate() > startOfMonth).length;

    const totalRevenue = safeOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const commissionEarned = totalRevenue * COMMISSION_RATE;
    
    // Placeholder values for metrics without a clear data source yet
    const pendingReviews = 0;
    const reportedItems = 0;
    const activeUsers = 0; // Requires more complex logic (e.g., tracking last sign-in)

    return {
      totalUsers,
      newUsers,
      activeUsers,
      totalProducts,
      activeListings,
      soldItems,
      totalOrders,
      ordersThisMonth,
      avgOrderValue,
      totalRevenue,
      commissionEarned,
      pendingReviews,
      reportedItems,
    };
  }, [users, products, orders]);

  const isLoading = usersLoading || productsLoading || ordersLoading;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={currencyFormatter.format(stats.totalRevenue)}
          description={`${stats.ordersThisMonth} orders this month`}
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Sales"
          value={`+${stats.totalOrders}`}
          description="All-time orders"
          icon={<ShoppingCart className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Users"
          value={`${stats.totalUsers}`}
          description={`+${stats.newUsers} in last 30 days`}
          icon={<Users className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Listings"
          value={`${stats.activeListings}`}
          description={`${stats.soldItems} items sold`}
          icon={<Package className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:grid-cols-2">
        <RevenueChart orders={orders || []} />
        <UsersChart users={users || []} />
      </div>
    </>
  );
}
