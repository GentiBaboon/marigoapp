'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageSquare, Clock, Truck, CheckCircle2 } from 'lucide-react';
import type { FirestoreOrder } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { STATUS_RANK, statusLabel, stepState, TIMELINE_STEPS } from '@/lib/order-status';

const TimelineDot = ({ state }: { state: 'completed' | 'current' | 'upcoming' }) => {
    return (
        <div className={cn("absolute left-0 top-1 h-4 w-4 rounded-full bg-background flex items-center justify-center -translate-x-[calc(50%-1px)]", {
            "z-10": state === 'current'
        })}>
            <div className={cn('h-full w-full rounded-full', {
                'bg-green-500': state === 'completed',
                'bg-blue-500 ring-4 ring-blue-200': state === 'current',
                'border-2 border-gray-300 bg-background': state === 'upcoming'
            })} />
        </div>
    )
}

function toDate(ts: any): Date {
    if (!ts) return new Date();
    if (typeof ts === 'string') return new Date(ts);
    if (typeof ts === 'object' && 'seconds' in ts) return new Date(ts.seconds * 1000);
    if (ts?.toDate) return ts.toDate();
    return new Date();
}

export function OrderTimeline({ order }: { order: FirestoreOrder }) {
    const { status } = order;
    const isTerminal = status === 'cancelled' || status === 'refunded';
    // When the order is cancelled/refunded, freeze the timeline at the
    // highest stage previously reached so completed steps stay green.
    const historyMaxRank = (order.statusHistory || []).reduce((max, e) => {
        const r = STATUS_RANK[e.status] ?? -1;
        return r > max ? r : max;
    }, -1);
    const liveRank = STATUS_RANK[status] ?? 0;
    const rank = isTerminal ? Math.max(historyMaxRank, 0) : liveRank;
    const shipByDate = addDays(toDate(order.createdAt), 7);
    const cancelDate = addDays(shipByDate, 1);

    const isAwaitingShip = !isTerminal && (status === 'confirmed' || status === 'processing' || status === 'in_preparation' || status === 'prepared');

    return (
        <div className="space-y-6">
            <div className="relative ml-2">
                <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />

                {TIMELINE_STEPS.map((step, idx) => {
                    const stepRank = STATUS_RANK[step] ?? idx + 1;
                    const state = stepState(rank, stepRank);
                    const isCurrentPrep = (step === 'in_preparation' || step === 'prepared') && isAwaitingShip && state === 'current';
                    const isCurrentShipped = step === 'shipped' && status === 'shipped' && state === 'current';
                    const isCurrentCompleted = step === 'completed' && status === 'completed' && state === 'current';

                    return (
                        <div key={step} className={cn("relative pl-8", idx === TIMELINE_STEPS.length - 1 ? "" : "pb-10")}>
                            <TimelineDot state={state} />
                            {step === 'confirmed' && state !== 'upcoming' ? (
                                <>
                                    <h4 className="font-semibold">{statusLabel('confirmed', 'buyer')}</h4>
                                    <p className="text-sm text-muted-foreground">On {format(toDate(order.createdAt), 'MMMM d, yyyy')}</p>
                                </>
                            ) : isCurrentShipped ? (
                                <Card className="shadow-md -ml-4 border-purple-500">
                                    <CardContent className="p-4 space-y-2">
                                        <Badge variant="outline" className="border-purple-500 text-purple-700 bg-purple-50 font-semibold">
                                            <Truck className="mr-1.5 h-3 w-3" />
                                            ON ITS WAY
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel('shipped', 'buyer')}</h4>
                                        <p className="text-sm text-muted-foreground">Your package is on its way and the courier will contact you in 24 hours. Please make sure to be available to pick up your order and not cause delays.</p>
                                    </CardContent>
                                </Card>
                            ) : isCurrentCompleted ? (
                                <Card className="shadow-md -ml-4 border-green-500">
                                    <CardContent className="p-4 space-y-2">
                                        <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50 font-semibold">
                                            <CheckCircle2 className="mr-1.5 h-3 w-3" />
                                            DELIVERED
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel('completed', 'buyer')}</h4>
                                        <p className="text-sm text-muted-foreground">Your order has been delivered. Thank you for shopping with Marigo!</p>
                                    </CardContent>
                                </Card>
                            ) : isCurrentPrep ? (
                                <Card className="shadow-md -ml-4">
                                    <CardContent className="p-4 space-y-3">
                                        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 font-semibold">
                                            <Clock className="mr-1.5 h-3 w-3" />
                                            IN PROGRESS
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel(status, 'buyer')}</h4>
                                        <p className="text-sm text-muted-foreground">Seller has until {format(shipByDate, 'EEEE, MMMM d, yyyy')} to ship the item.</p>
                                        <p className="text-sm text-muted-foreground">If they do not ship on time, we'll automatically cancel your order on {format(cancelDate, 'EEEE, MMMM d, yyyy')} and issue a full refund.</p>
                                        <Button variant="outline" className="w-full">
                                            <MessageSquare className="mr-2 h-4 w-4" />
                                            Contact seller
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <h4 className={cn("font-semibold", state !== 'upcoming' ? 'text-foreground' : 'text-muted-foreground')}>
                                    {statusLabel(step, 'buyer')}
                                </h4>
                            )}
                        </div>
                    );
                })}
            </div>

            {order.statusHistory && order.statusHistory.length > 0 && (
                <div className="border-t pt-4">
                    <h5 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status history</h5>
                    <ul className="space-y-2 text-sm">
                        {[...order.statusHistory]
                            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                            .map((entry, i) => {
                                const isBuyerAction = entry.by && entry.by === order.buyerId;
                                const isSellerAction = entry.by && (order.sellerIds || []).includes(entry.by);
                                const isAdminAction = entry.by && !isBuyerAction && !isSellerAction;
                                let label = statusLabel(entry.status, 'buyer');
                                if (entry.status === 'cancelled') {
                                    if (isAdminAction) label = 'Order cancelled by admin';
                                    else if (isSellerAction) label = 'Order cancelled by seller';
                                    else if (isBuyerAction) label = 'Order cancelled by customer';
                                } else if (entry.status === 'refunded') {
                                    if (isAdminAction) label = 'Order refunded by admin';
                                    else if (isSellerAction) label = 'Order refunded by seller';
                                    else if (isBuyerAction) label = 'Order refunded by customer';
                                }
                                return (
                                    <li key={`${entry.status}-${entry.at}-${i}`} className="flex justify-between gap-4">
                                        <span className="font-medium">{label}</span>
                                        <span className="text-muted-foreground">{format(new Date(entry.at), 'MMM d, yyyy · HH:mm')}</span>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            )}
        </div>
    );
}
