
'use client';
import { useMemo, useState } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import {
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import type {
  FirestoreUser,
  FirestoreProduct,
  FirestoreOrder,
  FirestoreReview,
  FirestoreReport,
  FirestoreSettings,
} from '@/lib/types';

import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Star,
  FileWarning,
  Repeat,
  TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { PeriodSelector, type Period } from '@/components/admin/charts/period-selector';

// Lazy load chart components (recharts is ~200KB) — only loaded when admin visits dashboard
const ChartSkeleton = () => <Skeleton className="h-[300px] w-full rounded-lg" />;
const RevenueChart = dynamic(() => import('@/components/admin/charts/revenue-chart').then(m => m.RevenueChart), { loading: ChartSkeleton });
const UsersChart = dynamic(() => import('@/components/admin/charts/users-chart').then(m => m.UsersChart), { loading: ChartSkeleton });
const OrdersStatusChart = dynamic(() => import('@/components/admin/charts/orders-status-chart').then(m => m.OrdersStatusChart), { loading: ChartSkeleton });
const TopCategoriesChart = dynamic(() => import('@/components/admin/charts/top-categories-chart').then(m => m.TopCategoriesChart), { loading: ChartSkeleton });
const OrdersByCountryChart = dynamic(() => import('@/components/admin/charts/orders-by-country-chart').then(m => m.OrdersByCountryChart), { loading: ChartSkeleton });

import { subDays } from 'date-fns';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const [period, setPeriod] = useState<Period>('30d');

  // Configurable commission rate from Firestore
  const settingsRef = useMemoFirebase(() => doc(firestore, 'settings', 'global'), [firestore]);
  const { data: settings } = useDoc<FirestoreSettings>(settingsRef);
  const commissionRate = settings?.commissionRate ?? 0.15;

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;

  // Data Fetching
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<FirestoreUser>(usersQuery);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: productsLoading } = useCollection<FirestoreProduct>(productsQuery);

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: orders, isLoading: ordersLoading } = useCollection<FirestoreOrder>(ordersQuery);
  
  const reviewsQuery = useMemoFirebase(() => collection(firestore, 'reviews'), [firestore]);
  const { data: reviews, isLoading: reviewsLoading } = useCollection<FirestoreReview>(reviewsQuery);

  const reportsQuery = useMemoFirebase(
    () => query(collection(firestore, 'reports'), where('status', '==', 'pending')),
    [firestore]
  );
  const { data: reports, isLoading: reportsLoading } = useCollection<FirestoreReport>(reportsQuery);


  // Memoized Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const periodAgo = subDays(now, periodDays);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const safeUsers = users || [];
    const safeProducts = products || [];
    const safeOrders = orders || [];
    const safeReviews = reviews || [];

    const totalUsers = safeUsers.length;
    const newUsers = safeUsers.filter(u => u.createdAt?.toDate && u.createdAt.toDate() > periodAgo).length;

    const totalProducts = safeProducts.length;
    const activeListings = safeProducts.filter(p => p.status === 'active').length;
    const soldItems = safeOrders.reduce((sum, order) => sum + order.items.length, 0);

    const totalOrders = safeOrders.length;
    const ordersInPeriod = safeOrders.filter(o => o.createdAt?.toDate && o.createdAt.toDate() > periodAgo).length;

    const totalRevenue = safeOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const commissionEarned = totalRevenue * commissionRate;

    const activeUsers = safeUsers.filter(u => u.lastLoginAt?.toDate && u.lastLoginAt.toDate() > periodAgo).length;

    // For now, "pending" reviews are just all reviews, since there's no status field
    const pendingReviews = safeReviews.length;

    const reportedItems = reports?.length || 0;

    // Repeat Buyers: buyers who placed more than 1 order
    const buyerOrderCounts = safeOrders.reduce<Record<string, number>>((acc, o) => {
      acc[o.buyerId] = (acc[o.buyerId] || 0) + 1;
      return acc;
    }, {});
    const uniqueBuyers = Object.keys(buyerOrderCounts).length;
    const repeatBuyers = Object.values(buyerOrderCounts).filter(c => c > 1).length;
    const repeatBuyerRate = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0;

    // Conversion Rate placeholder: orders / total users as a simple proxy
    const conversionRate = totalUsers > 0 ? Math.round((uniqueBuyers / totalUsers) * 100) : 0;

    return {
      totalUsers,
      newUsers,
      activeUsers,
      totalProducts,
      activeListings,
      soldItems,
      totalOrders,
      ordersInPeriod,
      avgOrderValue,
      totalRevenue,
      commissionEarned,
      pendingReviews,
      reportedItems,
      repeatBuyerRate,
      conversionRate,
    };
  }, [users, products, orders, reviews, reports, periodDays, commissionRate]);

  const isLoading = usersLoading || productsLoading || ordersLoading || reviewsLoading || reportsLoading;

  return (
    <>
        <div className="mb-8 flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    A real-time overview of your marketplace.
                </p>
            </div>
            <PeriodSelector value={period} onChange={setPeriod} />
        </div>


      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={currencyFormatter.format(stats.totalRevenue)}
          description={`${stats.ordersInPeriod} orders in period`}
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Sales"
          value={`+${stats.totalOrders}`}
          description={`${stats.soldItems} items sold all-time`}
          icon={<ShoppingCart className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Users"
          value={`${stats.totalUsers}`}
          description={`+${stats.newUsers} in last ${periodDays} days`}
          icon={<Users className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
         <StatCard
          title="Active Listings"
          value={`${stats.activeListings}`}
          description={`${stats.totalProducts} total products`}
          icon={<Package className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

       {/* Secondary Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 my-8">
         <StatCard
          title="Avg. Order Value"
          value={currencyFormatter.format(stats.avgOrderValue)}
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
         <StatCard
          title="Commission Earned"
          value={currencyFormatter.format(stats.commissionEarned)}
          description={`at ${commissionRate * 100}% rate`}
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Reviews"
          value={`${stats.pendingReviews}`}
          icon={<Star className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Reported Items"
          value={`${stats.reportedItems}`}
          icon={<FileWarning className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Repeat Buyers"
          value={`${stats.repeatBuyerRate}%`}
          description="Buyers with more than 1 order"
          icon={<Repeat className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          description="Buyers / total users"
          icon={<TrendingUp className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenueChart orders={orders || []} />
        <UsersChart users={users || []} />
        <OrdersStatusChart orders={orders || []} />
        <TopCategoriesChart products={products || []} />
        <div className="lg:col-span-2">
            <OrdersByCountryChart orders={orders || []} />
        </div>
      </div>
    </>
  );
}
