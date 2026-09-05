'use client';

import { useMemo } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { type FirestoreOrder, type FirestoreSettings, toDate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';

import { StatCard } from '@/components/admin/stat-card';
import { DollarSign, Percent, Banknote, Undo, Receipt } from 'lucide-react';
import { DataTable } from '@/components/admin/finance/data-table';
import { columns } from '@/components/admin/finance/columns';
import FinanceLoading from './loading';


export default function AdminFinancePage() {
  const { formatPrice } = useCurrency();
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

  // Stats are derived from the orders collection directly. `order.status` is
  // the single source of truth: completed → revenue + commission, refunded /
  // cancelled → counted in Total Refunds and subtracted from pending payouts.
  // No ledger query is needed — every refunded order shows up automatically
  // without requiring a separate `refund` or `transaction` doc to exist.
  const financialStats = useMemo(() => {
    const safeOrders = orders || [];

    const completedOrders = safeOrders.filter(o => o.status === 'completed');
    const refundedOrders = safeOrders.filter(o => o.status === 'refunded' || o.status === 'cancelled');

    const totalRevenue = completedOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
    const commissionEarned = totalRevenue * commissionRate;
    const totalRefunds = refundedOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
    const pendingPayouts = totalRevenue - commissionEarned - totalRefunds;
    const taxCollected = safeOrders.reduce((sum, o) => sum + ((o as any).taxAmount || 0), 0);

    return { totalRevenue, commissionEarned, pendingPayouts, totalRefunds, taxCollected };
  }, [orders, commissionRate]);

  if (isLoading) {
    return <FinanceLoading />;
  }

  // Data-table source: orders list (unchanged).
  const transactionRows = orders || [];

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
                      toDate(o.createdAt)?.toISOString() ?? '',
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
            value={formatPrice(financialStats.totalRevenue)}
            icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Commission Earned"
            value={formatPrice(financialStats.commissionEarned)}
            description={`at ${commissionRate * 100}% rate`}
            icon={<Percent className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Pending Payouts"
            value={formatPrice(financialStats.pendingPayouts)}
            icon={<Banknote className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Total Refunds"
            value={formatPrice(financialStats.totalRefunds)}
            icon={<Undo className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
             <StatCard
            title="Tax Collected"
            value={formatPrice(financialStats.taxCollected)}
            icon={<Receipt className="text-muted-foreground h-4 w-4" />}
            isLoading={isLoading}
            />
        </div>
        
        <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Transaction Log</h2>
            <DataTable columns={columns} data={transactionRows} />
        </div>
    </div>
  );
}
