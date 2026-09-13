'use client';
import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { MessageSquare, Clock, Pencil, Truck, CheckCircle2 } from 'lucide-react';
import type { FirestoreOrder, FirestoreAddress } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { STATUS_RANK, statusLabel, stepState, TIMELINE_STEPS_SELLER } from '@/lib/order-status';
import { TimelineStep } from '@/components/profile/timeline-rail';
import { PrintShippingLabel } from '@/components/profile/print-shipping-label';
import { PackingInstructionsDialog } from '@/components/profile/packing-instructions-dialog';
import { UpdateShippingOriginDialog } from '@/components/profile/update-shipping-origin-dialog';
import { useUser } from '@/firebase';

interface SellerOrderTimelineProps {
    order: FirestoreOrder;
    shippingFromAddress: FirestoreAddress;
}

export function SellerOrderTimeline({ order, shippingFromAddress }: SellerOrderTimelineProps) {
    const { status } = order;
    const { user } = useUser();
    const sellerUid = user?.uid;
    // Where the driver is told to come. The parent resolves this: the address
    // the seller last chose for this order, else their default one.
    const pickup = shippingFromAddress;
    const pickupAddressId = shippingFromAddress.id;
    const isTerminal = status === 'cancelled' || status === 'refunded';
    // A return flow runs after the order has been delivered + completed, so
    // every happy-path step must render as done. The active return progress
    // is shown in the separate <ReturnTimeline /> card.
    const isInReturnFlow = status === 'refund_requested' || status === 'return_initiated';
    const historyMaxRank = (order.statusHistory || []).reduce((max, e) => {
        const r = STATUS_RANK[e.status] ?? -1;
        return r > max ? r : max;
    }, -1);
    const liveRank = STATUS_RANK[status] ?? 0;
    const rank = isInReturnFlow
      ? 6
      : isTerminal
        ? Math.max(historyMaxRank, 0)
        : liveRank;

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

    const isAwaitingShip = !isTerminal && (status === 'confirmed' || status === 'processing' || status === 'in_preparation' || status === 'prepared');

    return (
        <div>
            {isTerminal && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                    <p className="font-semibold">Sale {status === 'cancelled' ? 'cancelled' : 'refunded'}</p>
                    <p className="text-xs text-red-700/80">Steps completed before this point remain marked done below.</p>
                </div>
            )}
            <div className="ml-2">
                {TIMELINE_STEPS_SELLER.map((step, idx) => {
                    const stepRank = STATUS_RANK[step] ?? idx + 1;
                    const state = stepState(rank, stepRank);
                    const renderActionCard = (step === 'in_preparation' || step === 'prepared') && isAwaitingShip && state === 'current';
                    const isCurrentShipped = step === 'shipped' && status === 'shipped' && state === 'current';
                    const isCurrentCompleted = step === 'completed' && status === 'completed' && state === 'current';

                    return (
                        <TimelineStep key={step} state={state} tone="orange" isLast={idx === TIMELINE_STEPS_SELLER.length - 1}>
                            {step === 'confirmed' && state !== 'upcoming' ? (
                                <>
                                    <h4 className="font-semibold">Sale confirmed</h4>
                                    <p className="text-sm text-muted-foreground">On {format(saleDate, 'MMMM d, yyyy')}</p>
                                </>
                            ) : isCurrentShipped ? (
                                <Card className="shadow-md border-purple-500">
                                    <CardContent className="p-4 space-y-2">
                                        <Badge variant="outline" className="border-purple-500 text-purple-700 bg-purple-50 font-semibold">
                                            <Truck className="mr-1.5 h-3 w-3" />
                                            ON ITS WAY
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel('shipped', 'seller')}</h4>
                                        <p className="text-sm text-muted-foreground">Your package is on its way to the customer and you will be notified when they have received it. Delivery estimated in 24 h.</p>
                                        <PrintShippingLabel order={order} sellerId={sellerUid} className="w-full" />
                                    </CardContent>
                                </Card>
                            ) : isCurrentCompleted ? (
                                <Card className="shadow-md border-green-500">
                                    <CardContent className="p-4 space-y-2">
                                        <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50 font-semibold">
                                            <CheckCircle2 className="mr-1.5 h-3 w-3" />
                                            DELIVERED
                                        </Badge>
                                        <h4 className="font-semibold text-lg">{statusLabel('completed', 'seller')}</h4>
                                        <p className="text-sm text-muted-foreground">The buyer has received the package. Your payout will be processed shortly.</p>
                                    </CardContent>
                                </Card>
                            ) : renderActionCard ? (
                                <Card className="shadow-md border-orange-500">
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
                                                <li>
                                                    Pack your item following our simple{' '}
                                                    <PackingInstructionsDialog>
                                                        <button type="button" className="underline font-medium">instructions</button>
                                                    </PackingInstructionsDialog>.
                                                </li>
                                                <li>Print the shipping label and attach it to your package.</li>
                                                {/* No drop-off network yet — the driver comes to the
                                                    seller, so the old "bring it to a drop-off point"
                                                    step asked for something that does not exist. */}
                                                <li>Mark your order as prepared and we will arrange the shipping. A driver picks it up within 1 to 2 days.</li>
                                            </ul>
                                        </div>

                                        <PrintShippingLabel
                                            order={order}
                                            sellerId={sellerUid}
                                            className="w-full bg-black text-white hover:bg-black/90 hover:text-white border-black"
                                        />

                                        <div className="border-t pt-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-sm">Shipping from</p>
                                                    <p className="text-sm">{pickup.fullName}</p>
                                                    <p className="text-sm">{pickup.address}, {pickup.city}, {pickup.postal} {pickup.country}</p>
                                                </div>
                                                <UpdateShippingOriginDialog order={order} currentAddressId={pickupAddressId}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Change pickup address">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </UpdateShippingOriginDialog>
                                            </div>
                                            <UpdateShippingOriginDialog order={order} currentAddressId={pickupAddressId}>
                                                <Button variant="outline" className="w-full">Update shipping details</Button>
                                            </UpdateShippingOriginDialog>
                                            <Button variant="outline" className="w-full" asChild>
                                                <Link href="/messages">
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                    Contact buyer
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <h4 className={cn("font-semibold", state !== 'upcoming' ? 'text-foreground' : 'text-muted-foreground')}>
                                    {statusLabel(step, 'seller')}
                                </h4>
                            )}
                        </TimelineStep>
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
