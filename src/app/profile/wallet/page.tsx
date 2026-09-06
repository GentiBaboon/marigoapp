'use client';

/**
 * Seller Wallet — a self-contained financial overview a seller can open from
 * their profile menu. It's purely Firestore-driven (no Stripe API call)
 * because the source of truth for "did money move" is `order.status` and the
 * platform's configured commission rate.
 *
 * Layout mirrors the admin /admin/finance page: a row of stat cards on top
 * and a transaction-style list below. Visual emphasis uses the green palette
 * to distinguish the seller's wallet from the order/listing pages.
 *
 * Money math:
 *   commissionRate ← settings/global.commissionRate (default 0.15)
 *   Per order, the seller's net = totalAmount * (1 - commissionRate).
 *   - Total Sales Revenue: sum of every sale (status = completed | confirmed |
 *     in_preparation | prepared | shipped | reserved). Reflects everything
 *     the buyer paid for.
 *   - Total Earnings: revenue × (1 - commissionRate). What this seller earned
 *     before refunds.
 *   - Available Balance: completed orders only × (1 - rate). Eligible for
 *     payout right now.
 *   - Pending Balance: in-flight orders × (1 - rate). Money that will become
 *     available once delivery is confirmed.
 *   - Refunded: refunded/cancelled orders × (1 - rate). Earnings clawed back.
 *   - Commission Paid: revenue × commissionRate.
 *
 * The transaction list below shows each sale row with a Sale/Refund tag,
 * the buyer-paid amount, the platform commission, and the seller's net for
 * that order — same column model as the admin finance view, only filtered
 * to the seller's own orders.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import type { FirestoreOrder, FirestoreSettings } from '@/lib/types';
import { toDate } from '@/lib/types';
import { newestFirst } from '@/lib/order-money';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/context/CurrencyContext';
import {
  ArrowLeft,
  Wallet as WalletIcon,
  TrendingUp,
  Hourglass,
  Banknote,
  Undo,
  ReceiptText,
  CalendarRange,
} from 'lucide-react';
import { format } from 'date-fns';

const COMPLETED_STATUSES = new Set(['completed']);
const REFUNDED_STATUSES = new Set(['refunded', 'cancelled']);
const PENDING_STATUSES = new Set([
  'confirmed',
  'processing',
  'in_preparation',
  'prepared',
  'shipped',
  'reserved',
  'pending_payment',
  'cancel_requested',
  'refund_requested',
  'return_initiated',
]);

/** One row in the insights list — icon on the left, label, value on the right.
 *  Designed to feel like an iOS settings row, not a dashboard tile. */
function InsightRow({
  icon: Icon,
  label,
  value,
  helper,
  accent = 'default',
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
  accent?: 'default' | 'positive' | 'pending' | 'negative';
  isLoading?: boolean;
}) {
  const accentClass =
    accent === 'positive'
      ? 'text-emerald-700'
      : accent === 'pending'
        ? 'text-amber-700'
        : accent === 'negative'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
      </div>
      <div className="text-right">
        {isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <p className={`text-base font-semibold ${accentClass}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

export default function SellerWalletPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();

  // Platform commission rate. Falls back to 15% if the global settings doc is
  // missing or doesn't carry the field.
  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'global') : null),
    [firestore],
  );
  const { data: settings } = useDoc<FirestoreSettings>(settingsRef);
  const commissionRate = settings?.commissionRate ?? 0.15;

  // Every order this seller is part of. No `orderBy`: paired with
  // `array-contains` it is a composite query, and the index it needs is not
  // deployed — the page threw `failed-precondition` and showed nothing.
  // Sorted in memory below instead (see `newestFirst`).
  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'orders'),
      where('sellerIds', 'array-contains', user.uid),
      limit(200),
    );
  }, [firestore, user?.uid]);
  const { data: rawOrders, isLoading } = useCollection<FirestoreOrder>(salesQuery);
  const orders = React.useMemo(() => newestFirst(rawOrders, (o) => toDate(o.createdAt as any)), [rawOrders]);

  // Calculate this seller's portion of each order. An order can contain items
  // from multiple sellers; only sum the line items whose sellerId is mine.
  const stats = React.useMemo(() => {
    const safeOrders = orders ?? [];
    let revenue = 0;
    let refunded = 0;
    let available = 0;
    let pending = 0;
    let salesCount = 0;
    let monthRevenue = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const o of safeOrders) {
      const myItems = (o.items || []).filter((it: any) => it?.sellerId === user?.uid);
      if (myItems.length === 0) continue;
      const mySubtotal = myItems.reduce((s, it: any) => s + (Number(it?.price) || 0), 0);

      if (REFUNDED_STATUSES.has(o.status)) {
        refunded += mySubtotal;
      } else if (COMPLETED_STATUSES.has(o.status)) {
        revenue += mySubtotal;
        available += mySubtotal * (1 - commissionRate);
        salesCount++;
        const od = toDate(o.createdAt as any);
        if (od && od >= monthStart) monthRevenue += mySubtotal;
      } else if (PENDING_STATUSES.has(o.status)) {
        revenue += mySubtotal;
        pending += mySubtotal * (1 - commissionRate);
        salesCount++;
        const od = toDate(o.createdAt as any);
        if (od && od >= monthStart) monthRevenue += mySubtotal;
      }
    }

    const totalEarnings = revenue * (1 - commissionRate);
    const commissionPaid = revenue * commissionRate;
    const refundedEarnings = refunded * (1 - commissionRate);
    const avgSale = salesCount > 0 ? revenue / salesCount : 0;

    return {
      revenue,
      totalEarnings,
      commissionPaid,
      available,
      pending,
      refunded,
      refundedEarnings,
      salesCount,
      monthRevenue,
      avgSale,
    };
  }, [orders, user?.uid, commissionRate]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header — green-tinted to match the menu pill the user clicked */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <WalletIcon className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Track your sales, earnings, and what&apos;s ready to be paid out.
            </p>
          </div>
        </div>
      </div>

      {/* Hero — one big number, no distraction. This is the only headline
          metric the seller cares about most: what they actually earned. */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-100/90">Total Earnings</p>
        {isLoading ? (
          <Skeleton className="h-10 w-40 mt-2 bg-emerald-300/40" />
        ) : (
          <p className="text-4xl font-extrabold tracking-tight mt-1">{formatPrice(stats.totalEarnings)}</p>
        )}
        <p className="text-xs text-emerald-50/90 mt-2">
          From {stats.salesCount} sale{stats.salesCount === 1 ? '' : 's'} · after {(commissionRate * 100).toFixed(0)}% commission
        </p>
      </div>

      {/* Insights list — each row reads naturally, no grid of dashboard tiles. */}
      <Card>
        <CardContent className="px-4 py-1 divide-y">
          <InsightRow
            icon={TrendingUp}
            label="Total Sales Revenue"
            helper="What buyers paid for your items"
            value={formatPrice(stats.revenue)}
            isLoading={isLoading}
          />
          <InsightRow
            icon={Banknote}
            label="Ready for payout"
            helper="Completed orders, available now"
            value={formatPrice(stats.available)}
            accent="positive"
            isLoading={isLoading}
          />
          <InsightRow
            icon={Hourglass}
            label="Pending"
            helper="In-flight orders not yet completed"
            value={formatPrice(stats.pending)}
            accent="pending"
            isLoading={isLoading}
          />
          <InsightRow
            icon={Undo}
            label="Refunded"
            helper="Earnings clawed back from refunds"
            value={formatPrice(stats.refundedEarnings)}
            accent="negative"
            isLoading={isLoading}
          />
          <InsightRow
            icon={ReceiptText}
            label="Commission paid"
            helper={`${(commissionRate * 100).toFixed(0)}% platform fee on all sales`}
            value={formatPrice(stats.commissionPaid)}
            isLoading={isLoading}
          />
          <InsightRow
            icon={CalendarRange}
            label="This month"
            helper={`Avg sale ${formatPrice(stats.avgSale)}`}
            value={formatPrice(stats.monthRevenue)}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Recent activity — one row per order I've been part of. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Sales and refunds — net amount shows what hit your wallet for each order.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sales yet. List an item to start earning.
            </div>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => {
                const myItems = (o.items || []).filter((it: any) => it?.sellerId === user?.uid);
                if (myItems.length === 0) return null;
                const sub = myItems.reduce((s, it: any) => s + (Number(it?.price) || 0), 0);
                const isRefund = REFUNDED_STATUSES.has(o.status);
                const isPending = PENDING_STATUSES.has(o.status);
                const commission = sub * commissionRate;
                const net = sub - commission;
                const signedNet = isRefund ? -net : net;
                const firstItem = myItems[0];
                const orderDate = toDate(o.createdAt as any);

                return (
                  <li key={o.id}>
                    <Link
                      href={`/profile/listings/sales/${o.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
                    >
                      {firstItem?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstItem.image}
                          alt={firstItem.title || 'Item'}
                          className="h-10 w-10 rounded-md object-cover bg-muted shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {firstItem?.title || `#${o.orderNumber}`}
                          </p>
                          {isRefund && <Badge variant="destructive" className="text-[10px]">Refund</Badge>}
                          {!isRefund && isPending && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                          {!isRefund && !isPending && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                              Paid
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          #{o.orderNumber}{orderDate ? ` · ${format(orderDate, 'd MMM, yyyy')}` : ''} · Commission {formatPrice(commission)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isRefund ? 'text-destructive' : 'text-emerald-700'}`}>
                          {isRefund ? '−' : '+'}{formatPrice(Math.abs(signedNet))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Sale {formatPrice(sub)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
