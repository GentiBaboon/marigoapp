'use client';
import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageSquare, Clock, Copy, Pencil } from 'lucide-react';
import type { FirestoreOrder, FirestoreAddress } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { STATUS_RANK, statusLabel, stepState, TIMELINE_STEPS } from '@/lib/order-status';

const TimelineDot = ({ state }: { state: 'completed' | 'current' | 'upcoming' }) => {
    return (
        <div className={cn("absolute left-0 top-1 h-4 w-4 rounded-full bg-background flex items-center justify-center -translate-x-[calc(50%-1px)]", {
            "z-10": state === 'current'
        })}>
            <div className={cn('h-full w-full rounded-full', {
                'bg-green-500': state === 'completed',
                'bg-orange-500 ring-4 ring-orange-200': state === 'current',
                'border-2 border-gray-300 bg-background': state === 'upcoming'
            })} />
        </div>
    )
}

interface SellerOrderTimelineProps {
    order: FirestoreOrder;
    shippingFromAddress: FirestoreAddress;
}

export function SellerOrderTimeline({ order, shippingFromAddress }: SellerOrderTimelineProps) {
    const { status } = order;
    const { toast } = useToast();
    const rank = STATUS_RANK[status] ?? 0;

    const createdMs = (() => {
        const c = order.createdAt as any;
        if (!c) return Date.now();
        if (typeof c.toDate === 'function') return c.toDate().getTime();
        if (typeof c.seconds === 'number') return c.seconds * 1000;
        if (typeof c === 'string') return new Date(c).getTime() || Date.now();
        return Date.now();
    })();
    const saleDate = new Date(createdMs);
    const shipByDate = addDays(saleDate, 7);

    const isAwaitingShip = status === 'confirmed' || status === 'processing' || status === 'in_preparation' || status === 'prepared';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied to clipboard!' });
        });
    }

    return (
        <div>
            <div className="relative ml-2">
                <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />

                {TIMELINE_STEPS.map((step, idx) => {
                    const stepRank = STATUS_RANK[step] ?? idx + 1;
                    const state = stepState(rank, stepRank);
                    const renderActionCard = (step === 'in_preparation' || step === 'prepared') && isAwaitingShip && state === 'current';

                    return (
                        <div key={step} className={cn("relative pl-8", idx === TIMELINE_STEPS.length - 1 ? "" : "pb-10")}>
                            <TimelineDot state={state} />
                            {step === 'confirmed' && state !== 'upcoming' ? (
                                <>
                                    <h4 className="font-semibold">Sale confirmed</h4>
                                    <p className="text-sm text-muted-foreground">On {format(saleDate, 'MMMM d, yyyy')}</p>
                                </>
                            ) : renderActionCard ? (
                                <Card className="shadow-md -ml-4 border-orange-500">
                                    <CardContent className="p-4 space-y-4">
                                        <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 font-semibold">
                                            <Clock className="mr-1.5 h-3 w-3" />
                                            ACTION NEEDED
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel(status, 'seller')}</h4>
                                        <p className="text-sm text-muted-foreground">Ship by {format(shipByDate, 'EEEE, MMMM d, yyyy')} otherwise your sale will be automatically cancelled.</p>

                                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                                            <h5 className="font-semibold text-sm">NEXT STEPS</h5>
                                            <ul className="list-disc pl-5 text-sm space-y-1">
                                                <li>Pack your item following our simple <a href="#" className="underline">instructions</a>.</li>
                                                <li>Print the shipping label and attach it to your package.</li>
                                                <li>Bring your package to a drop-off-point.</li>
                                            </ul>
                                        </div>

                                        <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                                            <h5 className="font-semibold text-sm">BRT - Drop off</h5>
                                            <p className="text-sm">See nearest <a href="#" className="underline">drop-off points</a> (view <a href="#" className="underline">carrier's website</a>).</p>
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Tracking: </span>
                                                <span className="font-semibold">005125901002419 </span>
                                                <Copy className="h-3 w-3 inline-block cursor-pointer" onClick={() => copyToClipboard('005125901002419')} />
                                            </div>
                                            <Button className="w-full bg-black hover:bg-black/90 text-white">Get printable label</Button>
                                        </div>

                                        <div className="border-t pt-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-sm">Shipping from</p>
                                                    <p className="text-sm">{shippingFromAddress.fullName}</p>
                                                    <p className="text-sm">{shippingFromAddress.address}, {shippingFromAddress.city}, {shippingFromAddress.postal} {shippingFromAddress.country}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Pencil className="h-4 w-4" /></Button>
                                            </div>
                                            <Button variant="outline" className="w-full">Update shipping details</Button>
                                            <Button variant="outline" className="w-full">
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Contact buyer
                                            </Button>
                                            <Button variant="link" className="w-full text-destructive">Cancel sale</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <h4 className={cn("font-semibold", state !== 'upcoming' ? 'text-foreground' : 'text-muted-foreground')}>
                                    {statusLabel(step, 'seller')}
                                </h4>
                            )}
                        </div>
                    );
                })}
            </div>

            {order.statusHistory && order.statusHistory.length > 0 && (
                <div className="border-t mt-6 pt-4">
                    <h5 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status history</h5>
                    <ul className="space-y-2 text-sm">
                        {[...order.statusHistory]
                            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                            .map((entry, i) => (
                                <li key={`${entry.status}-${entry.at}-${i}`} className="flex justify-between gap-4">
                                    <span className="font-medium">{statusLabel(entry.status, 'seller')}</span>
                                    <span className="text-muted-foreground">{format(new Date(entry.at), 'MMM d, yyyy · HH:mm')}</span>
                                </li>
                            ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
