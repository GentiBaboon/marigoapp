'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
    Wallet, 
    ArrowUpRight, 
    Clock, 
    CheckCircle2, 
    CircleDollarSign,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import { useCurrency } from '@/context/CurrencyContext';
import { 
    ResponsiveContainer, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip 
} from 'recharts';
import { format, subDays, isWithinInterval, startOfDay } from 'date-fns';
import Link from 'next/link';
import { type FirestoreOrder, type FirestorePayoutRequest, type FirestoreSettings, DEFAULT_COMMISSION_RATE, toDate } from '@/lib/types';
import { isSettled, newestFirst, sellerNet } from '@/lib/order-money';
import {
    amountToMinimum,
    canRequestWithdrawal,
    MIN_WITHDRAWAL_ALL,
    summarizeSellerBalance,
} from '@/lib/payouts';

export default function SellerEarningsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { formatPrice } = useCurrency();
    const { toast } = useToast();

    // Fetch Seller's Orders for History & Chart
    const salesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // No `orderBy`: with `array-contains` that is a composite query whose
        // index is not deployed, and the page threw `failed-precondition`.
        return query(
            collection(firestore, 'orders'),
            where('sellerIds', 'array-contains', user.uid),
            limit(100)
        );
    }, [user, firestore]);

    // This seller's withdrawal requests — open ones hold part of the balance.
    const payoutQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'payout_requests'), where('sellerId', '==', user.uid), limit(50));
    }, [user, firestore]);

    const { data: rawSales, isLoading: isSalesLoading } = useCollection<FirestoreOrder>(salesQuery);
    const sales = useMemo(() => newestFirst(rawSales, (o) => toDate(o.createdAt)), [rawSales]);

    // The live rate, not a hardcoded 0.85 — and applied to *this seller's*
    // lines only. The page used to multiply the whole order's `totalAmount`,
    // which included the delivery fee and, on a multi-seller order, the other
    // sellers' items.
    const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings', 'global') : null), [firestore]);
    const { data: settings } = useDoc<FirestoreSettings>(settingsRef);
    const commissionRate = settings?.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const myNet = (sale: FirestoreOrder) => (user ? sellerNet(sale, user.uid, commissionRate) : 0);

    // Balance comes from Firestore, not Stripe.
    //
    // This page used to call the `getSellerBalance` and `requestPayout`
    // callables. Both are Stripe Connect paths: they need a connected account
    // and a captured card balance. Card payments are switched off
    // (CARD_PAYMENTS_ENABLED) and the Connect functions cannot even be invoked
    // — the org policy blocks the `allUsers` grant — so the fetch failed CORS
    // on every load and the payout button threw for every seller who pressed
    // it. Almost all money here is cash collected at the door, and it is paid
    // out by hand; `src/lib/payouts.ts` is the model for that, shared with the
    // wallet so the two pages cannot disagree about one balance.
    const { data: rawRequests } = useCollection<FirestorePayoutRequest>(payoutQuery);
    const balance = useMemo(
        () => summarizeSellerBalance(sales as any, user?.uid ?? '', commissionRate, rawRequests ?? []),
        [sales, user?.uid, commissionRate, rawRequests],
    );
    const gate = canRequestWithdrawal(balance);
    const shortfall = amountToMinimum(balance.available);

    // Calculate Chart Data
    const chartData = useMemo(() => {
        if (!sales) return [];
        
        const days = Array.from({ length: 30 }, (_, i) => {
            const date = subDays(new Date(), i);
            return {
                date: format(date, 'MMM dd'),
                timestamp: startOfDay(date).getTime(),
                amount: 0
            };
        }).reverse();

        sales.forEach(sale => {
            // Earned means delivered and closed. A shipped parcel can still
            // be refused at the door on cash on delivery.
            if (isSettled(sale.status)) {
                const saleDate = toDate(sale.createdAt);
                if (!saleDate) return;
                const dayMatch = days.find(d => 
                    isWithinInterval(saleDate, { 
                        start: startOfDay(new Date(d.timestamp)), 
                        end: new Date(d.timestamp + 86399999) 
                    })
                );
                if (dayMatch) {
                    dayMatch.amount += myNet(sale);
                }
            }
        });

        return days;
    }, [sales, commissionRate, user]);

    const totalLifetimeEarnings = useMemo(() => {
        return sales?.reduce((sum, s) => (isSettled(s.status) ? sum + myNet(s) : sum), 0) || 0;
    }, [sales, commissionRate, user]);

    if (!user) return null;

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
            <div className="flex items-center gap-4">
                <Button asChild variant="ghost" size="icon">
                    <Link href="/profile">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">Earnings Dashboard</h1>
                    <p className="text-muted-foreground">Manage your sales revenue and payouts.</p>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary text-primary-foreground">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CircleDollarSign className="h-4 w-4" />
                            Lifetime Earnings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {isSalesLoading ? <Skeleton className="h-9 w-32 bg-primary-foreground/20" /> : formatPrice(totalLifetimeEarnings)}
                        </div>
                        <p className="text-xs text-primary-foreground/70 mt-1">Your items on delivered orders, after {Math.round(commissionRate * 100)}% commission</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            On the way to you
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {isSalesLoading ? <Skeleton className="h-9 w-32" /> : formatPrice(balance.clearing + balance.pending)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Sold, but the cash has not reached us yet
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Available to withdraw
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-3xl font-bold text-green-700">
                            {isSalesLoading ? <Skeleton className="h-9 w-32" /> : formatPrice(balance.available)}
                        </div>
                        {/* Withdrawing happens on the wallet, which owns the
                            form and the request history — two places to start
                            the same flow is how they drift apart. */}
                        <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                            <Link href="/profile/wallet">
                                <Wallet className="h-4 w-4 mr-2" />
                                {gate.ok ? 'Withdraw to my bank' : 'Go to my wallet'}
                            </Link>
                        </Button>
                        {!gate.ok && shortfall > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                {formatPrice(shortfall)} more to reach the{' '}
                                {MIN_WITHDRAWAL_ALL.toLocaleString('de-DE')} ALL minimum
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Sales Performance</CardTitle>
                    <CardDescription>Net earnings over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                minTickGap={30}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(val) => `€${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(val: number) => [formatPrice(val), 'Net Earnings']}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="hsl(var(--primary))" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorAmount)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Transaction History */}
            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>Recent sales and their current payment status.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {isSalesLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="p-4 flex justify-between items-center">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-6 w-20" />
                                </div>
                            ))
                        ) : sales?.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                No transactions yet. Start selling to see your history!
                            </div>
                        ) : (
                            sales?.map(sale => (
                                <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-muted h-10 w-10 rounded-full flex items-center justify-center">
                                            <ArrowUpRight className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Sale #{sale.orderNumber}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(toDate(sale.createdAt) ?? new Date(), 'PPP')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">{formatPrice(myNet(sale))}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                            isSettled(sale.status) ? 'bg-green-100 text-green-700'
                                            : ['cancelled', 'refunded'].includes(sale.status) ? 'bg-muted text-muted-foreground'
                                            : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {isSettled(sale.status) ? 'Earned'
                                             : ['cancelled', 'refunded'].includes(sale.status) ? 'Reversed'
                                             : 'Awaiting delivery'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
