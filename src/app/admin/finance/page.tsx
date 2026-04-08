'use client';

import { useMemo } from 'react';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import type { FirestoreOrder, FirestoreSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';

import { StatCard } from '@/components/admin/stat-card';
import { DollarSign, Percent, Banknote, Undo, Receipt } from 'lucide-react';
import { DataTable } from '@/components/admin/finance/data-table';
import { columns } from '@/components/admin/finance/columns';
import FinanceLoading from './loading';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export default function AdminFinancePage() {
  const firestore = useFirestore();

  // Configurable commission rate from Firestore
  const settingsRef = useMemoFirebase(() => doc(firestore, 'settings', 'global'), [firestore]);
  const { data: settings } = useDoc<FirestoreSettings>(settingsRef);
  const commissionRate = settings?.commissionRate ?? 0.15;

  const ordersQuery = useMemoFirebase(
    () => query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: orders, isLoading } =
    useCollection<FirestoreOrder>(ordersQuery);

  const financialStats = useMemo(() => {
    const safeOrders = orders || [];
    
    const completedOrders = safeOrders.filter(o => o.status === 'completed');
    const refundedOrders = safeOrders.filter(o => o.status === 'refunded');

    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const commissionEarned = totalRevenue * commissionRate;
    const totalRefunds = refundedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Placeholder for pending payouts, would need more complex logic
    const pendingPayouts = totalRevenue - commissionEarned - totalRefunds;

    // Tax collected
    const taxCollected = safeOrders.reduce((sum, o) => sum + ((o as any).taxAmount || 0), 0);

    return {
        totalRevenue,
        commissionEarned,
        pendingPayouts,
        totalRefunds,
        taxCollected,
    };
  }, [orders, commissionRate]);

  if (isLoading) {
    return <FinanceLoading />;
  }

  // Treat orders as transactions for the data table
  const transactions = orders || [];

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon">
                    <Link href="/admin">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Financials</h1>
                    <p className="text-muted-foreground">
                        Track revenue, commissions, and payouts.
                    </p>
                </div>
            </div>
             <Button
                variant="outline"
                onClick={() => {
                  const csvRows = [
                    ['Order #', 'Amount', 'Status', 'Date'].join(','),
                    ...(orders || []).map(o => [
                      o.orderNumber,
                      o.totalAmount.toFixed(2),
                      o.status,
                      o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString() : '',
                    ].join(','))
                  ];
                  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `marigo-finance-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Data
            </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
            title="Total Revenue"
            value={currencyFormatter.format(financialStats.totalRevenue)}
            icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Commission Earned"
            value={currencyFormatter.format(financialStats.commissionEarned)}
            description={`at ${commissionRate * 100}% rate`}
            icon={<Percent className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Pending Payouts"
            value={currencyFormatter.format(financialStats.pendingPayouts)}
            icon={<Banknote className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Total Refunds"
            value={currencyFormatter.format(financialStats.totalRefunds)}
            icon={<Undo className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Tax Collected"
            value={currencyFormatter.format(financialStats.taxCollected)}
            icon={<Receipt className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
        </div>
        
        <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Transaction Log</h2>
            <DataTable columns={columns} data={transactions} />
        </div>
    </div>
  );
}
