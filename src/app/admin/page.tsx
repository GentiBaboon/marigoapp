'use client';
import { useMemo } from 'react';
import Link from 'next/link'; // Import Link
import { collection, query, where } from 'firebase/firestore';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import type {
  FirestoreUser,
  FirestoreProduct,
  FirestoreOrder,
  FirestoreReview,
} from '@/lib/types';

import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Star,
  FileWarning,
  ShieldAlert,
  Settings,
  Archive,
  Truck,
} from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { RevenueChart } from '@/components/admin/charts/revenue-chart';
import { UsersChart } from '@/components/admin/charts/users-chart';
import { OrdersStatusChart } from '@/components/admin/charts/orders-status-chart';
import { TopCategoriesChart } from '@/components/admin/charts/top-categories-chart';
import { OrdersByCountryChart } from '@/components/admin/charts/orders-by-country-chart';

import { subDays } from 'date-fns';
import { Button } from '@/components/ui/button';

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
  
  const reviewsQuery = useMemoFirebase(() => collection(firestore, 'reviews'), [firestore]);
  const { data: reviews, isLoading: reviewsLoading } = useCollection<FirestoreReview>(reviewsQuery);


  // Memoized Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const safeUsers = users || [];
    const safeProducts = products || [];
    const safeOrders = orders || [];
    const safeReviews = reviews || [];

    const totalUsers = safeUsers.length;
    const newUsers = safeUsers.filter(u => u.createdAt?.toDate && u.createdAt.toDate() > thirtyDaysAgo).length;

    const totalProducts = safeProducts.length;
    const activeListings = safeProducts.filter(p => p.status === 'active').length;
    const soldItems = safeOrders.reduce((sum, order) => sum + order.items.length, 0);

    const totalOrders = safeOrders.length;
    const ordersThisMonth = safeOrders.filter(o => o.createdAt?.toDate && o.createdAt.toDate() > startOfMonth).length;

    const totalRevenue = safeOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const commissionEarned = totalRevenue * COMMISSION_RATE;
    
    // Placeholder for active users - requires more complex logic
    const activeUsers = 0; 

    // For now, "pending" reviews are just all reviews, since there's no status field
    const pendingReviews = safeReviews.length;
    
    // Placeholder for reported items - requires data model changes
    const reportedItems = 0;

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
  }, [users, products, orders, reviews]);

  const isLoading = usersLoading || productsLoading || ordersLoading || reviewsLoading;

  return (
    <>
        <div className="flex justify-between items-start mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    A real-time overview of your marketplace.
                </p>
            </div>
            <div className="flex gap-2 flex-wrap">
                <Button asChild>
                    <Link href="/admin/products">Manage Products</Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/orders">Orders</Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/users">Manage Users</Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/finance">Financials</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/logistics">
                        <Truck className="mr-2 h-4 w-4" />
                        Logistics
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/moderation">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Moderation
                    </Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/logs">
                        <Archive className="mr-2 h-4 w-4" />
                        Activity Logs
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
        </div>


      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          description={`${stats.soldItems} items sold all-time`}
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
          description={`${stats.totalProducts} total products`}
          icon={<Package className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

       {/* Secondary Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 my-8">
         <StatCard
          title="Avg. Order Value"
          value={currencyFormatter.format(stats.avgOrderValue)}
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          isLoading={isLoading}
        />
         <StatCard
          title="Commission Earned"
          value={currencyFormatter.format(stats.commissionEarned)}
          description={`at ${COMMISSION_RATE * 100}% rate`}
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
