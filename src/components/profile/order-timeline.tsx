'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageSquare, Clock } from 'lucide-react';
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
    const rank = STATUS_RANK[status] ?? 0;
    const shipByDate = addDays(toDate(order.createdAt), 7);
    const cancelDate = addDays(shipByDate, 1);

    const isAwaitingShip = status === 'confirmed' || status === 'processing' || status === 'in_preparation' || status === 'prepared';

    return (
        <div className="space-y-6">
            <div className="relative ml-2">
                <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />

                {TIMELINE_STEPS.map((step, idx) => {
                    const stepRank = STATUS_RANK[step] ?? idx + 1;
                    const state = stepState(rank, stepRank);
                    const isCurrentPrep = (step === 'in_preparation' || step === 'prepared') && isAwaitingShip && state === 'current';

                    return (
                        <div key={step} className={cn("relative pl-8", idx === TIMELINE_STEPS.length - 1 ? "" : "pb-10")}>
                            <TimelineDot state={state} />
                            {step === 'confirmed' && state !== 'upcoming' ? (
                                <>
                                    <h4 className="font-semibold">{statusLabel('confirmed', 'buyer')}</h4>
                                    <p className="text-sm text-muted-foreground">On {format(toDate(order.createdAt), 'MMMM d, yyyy')}</p>
                                </>
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
                            .map((entry, i) => (
                                <li key={`${entry.status}-${entry.at}-${i}`} className="flex justify-between gap-4">
                                    <span className="font-medium">{statusLabel(entry.status, 'buyer')}</span>
                                    <span className="text-muted-foreground">{format(new Date(entry.at), 'MMM d, yyyy · HH:mm')}</span>
                                </li>
                            ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
