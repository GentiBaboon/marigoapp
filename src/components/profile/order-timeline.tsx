'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageSquare, Clock } from 'lucide-react';
import type { FirestoreOrder } from '@/lib/types';
import { format, addDays } from 'date-fns';

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

    const shipByDate = addDays(toDate(order.createdAt), 7);
    const cancelDate = addDays(shipByDate, 1);
    
    // Statuses: processing, shipped, delivered, completed
    const isProcessing = status === 'processing';
    const isShipped = status === 'shipped';
    const isDelivered = status === 'delivered';
    const isCompleted = status === 'completed';

    const hasPassedProcessing = isShipped || isDelivered || isCompleted;
    const hasPassedShipping = isDelivered || isCompleted;
    
    return (
        <div className="relative ml-2">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />

            {/* Step 1: Order Received */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state="completed" />
                <h4 className="font-semibold">Order received</h4>
                <p className="text-sm text-muted-foreground">On {format(toDate(order.createdAt), 'MMMM d, yyyy')}</p>
            </div>

            {/* Step 2: Waiting for Seller to Ship */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state={isProcessing ? 'current' : hasPassedProcessing ? 'completed' : 'upcoming'} />
                {isProcessing ? (
                    <Card className="shadow-md -ml-4">
                        <CardContent className="p-4 space-y-3">
                             <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 font-semibold">
                                <Clock className="mr-1.5 h-3 w-3" />
                                IN PROGRESS
                             </Badge>
                             <h4 className="font-semibold text-lg">Waiting for seller to ship</h4>
                             <p className="text-sm text-muted-foreground">Seller has until {format(shipByDate, 'EEEE, MMMM d, yyyy')} to ship the item.</p>
                             <p className="text-sm text-muted-foreground">If they do not ship on time, we'll automatically cancel your order on {format(cancelDate, 'EEEE, MMMM d, yyyy')} and issue a full refund to your payment method.</p>
                             <p className="text-sm underline cursor-pointer font-medium text-foreground">See full cancellation policy</p>
                             <Button variant="outline" className="w-full">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contact seller
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <h4 className={cn("font-semibold", hasPassedProcessing ? 'text-foreground' : 'text-muted-foreground')}>Waiting for seller to ship</h4>
                )}
            </div>

            {/* Step 3: Delivery */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state={isShipped ? 'current' : hasPassedShipping ? 'completed' : 'upcoming'} />
                 <h4 className={cn("font-semibold", hasPassedShipping ? "text-foreground" : "text-muted-foreground")}>Delivery</h4>
                 <p className="text-sm text-muted-foreground">Within 5 business days</p>
            </div>
            
            {/* Step 4: Item Received */}
            <div className="relative pl-8">
                 <TimelineDot state={isDelivered ? 'current' : isCompleted ? 'completed' : 'upcoming'} />
                <h4 className={cn("font-semibold", isCompleted ? "text-foreground" : "text-muted-foreground")}>Item received</h4>
            </div>
        </div>
    )
}
