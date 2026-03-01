'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
import type { FirestoreOrder } from '@/lib/types';

export default function SellerEarningsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { formatPrice } = useCurrency();
    const { toast } = useToast();
    const functions = getFunctions();

    const [stripeBalance, setStripeBalance] = useState({ available: 0, pending: 0 });
    const [isBalanceLoading, setIsBalanceLoading] = useState(true);
    const [isRequestingPayout, setIsRequestingPayout] = useState(false);

    // Fetch Seller's Orders for History & Chart
    const salesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'orders'),
            where('sellerIds', 'array-contains', user.uid),
            orderBy('createdAt', 'desc'),
            limit(100)
        );
    }, [user, firestore]);

    const { data: sales, isLoading: isSalesLoading } = useCollection<FirestoreOrder>(salesQuery);

    // Fetch Balance from Stripe via Cloud Function
    useEffect(() => {
        if (!user) return;

        const fetchBalance = async () => {
            setIsBalanceLoading(true);
            try {
                const getSellerBalance = httpsCallable(functions, 'getSellerBalance');
                const result: any = await getSellerBalance();
                setStripeBalance({
                    available: result.data.available || 0,
                    pending: result.data.pending || 0
                });
            } catch (error) {
                console.error("Balance fetch error:", error);
            } finally {
                setIsBalanceLoading(false);
            }
        };

        fetchBalance();
    }, [user, functions]);

    const handleRequestPayout = async () => {
        if (stripeBalance.available <= 0) return;
        
        setIsRequestingPayout(true);
        try {
            const requestPayout = httpsCallable(functions, 'requestPayout');
            await requestPayout();
            toast({
                title: "Payout Requested!",
                description: "Your funds are being transferred to your bank account."
            });
            // Update balance locally
            setStripeBalance(prev => ({ ...prev, available: 0 }));
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Payout Failed",
                description: error.message || "Could not process payout."
            });
        } finally {
            setIsRequestingPayout(false);
        }
    };

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
            if (sale.status === 'completed' || sale.status === 'delivered' || sale.status === 'shipped') {
                const saleDate = sale.createdAt.toDate();
                const dayMatch = days.find(d => 
                    isWithinInterval(saleDate, { 
                        start: startOfDay(new Date(d.timestamp)), 
                        end: new Date(d.timestamp + 86399999) 
                    })
                );
                if (dayMatch) {
                    dayMatch.amount += sale.totalAmount * 0.85; // Net 85%
                }
            }
        });

        return days;
    }, [sales]);

    const totalLifetimeEarnings = useMemo(() => {
        return sales?.reduce((sum, s) => {
            if (s.status === 'completed') return sum + (s.totalAmount * 0.85);
            return sum;
        }, 0) || 0;
    }, [sales]);

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
                        <p className="text-xs text-primary-foreground/70 mt-1">Total revenue after 15% commission</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Pending (Escrow)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {isBalanceLoading ? <Skeleton className="h-9 w-32" /> : formatPrice(stripeBalance.pending)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Held until 72h after delivery</p>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Available for Payout
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-3xl font-bold text-green-700">
                            {isBalanceLoading ? <Skeleton className="h-9 w-32" /> : formatPrice(stripeBalance.available)}
                        </div>
                        <Button 
                            className="w-full bg-green-600 hover:bg-green-700 text-white" 
                            disabled={stripeBalance.available <= 0 || isRequestingPayout}
                            onClick={handleRequestPayout}
                        >
                            {isRequestingPayout ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                            Request Payout
                        </Button>
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
                                                {format(sale.createdAt.toDate(), 'PPP')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">{formatPrice(sale.totalAmount * 0.85)}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                            sale.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {sale.status === 'completed' ? 'Paid' : 'In Escrow'}
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
