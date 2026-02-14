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

    const saleDate = new Date(order.createdAt.seconds * 1000);
    const shipByDate = addDays(saleDate, 7);
    
    const isProcessing = status === 'processing';
    const isShipped = status === 'shipped';
    const isDelivered = status === 'delivered';
    const isCompleted = status === 'completed';

    const hasPassedProcessing = isShipped || isDelivered || isCompleted;
    const hasPassedShipping = isDelivered || isCompleted;
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied to clipboard!' });
        });
    }

    return (
        <div className="relative ml-2">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />

            {/* Step 1: Sale Confirmed */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state="completed" />
                <h4 className="font-semibold">Sale confirmed</h4>
                <p className="text-sm text-muted-foreground">On {format(saleDate, 'MMMM d, yyyy')}</p>
            </div>

            {/* Step 2: Waiting for Seller to Ship */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state={isProcessing ? 'current' : hasPassedProcessing ? 'completed' : 'upcoming'} />
                {isProcessing ? (
                    <Card className="shadow-md -ml-4 border-orange-500">
                        <CardContent className="p-4 space-y-4">
                             <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 font-semibold">
                                <Clock className="mr-1.5 h-3 w-3" />
                                ACTION NEEDED
                             </Badge>
                             <h4 className="font-semibold text-lg">Waiting to be shipped</h4>
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
                    <h4 className={cn("font-semibold", hasPassedProcessing ? 'text-foreground' : 'text-muted-foreground')}>Waiting for seller to ship</h4>
                )}
            </div>

            {/* Step 3: Delivery */}
            <div className="relative pl-8 pb-10">
                <TimelineDot state={isShipped ? 'current' : hasPassedShipping ? 'completed' : 'upcoming'} />
                 <h4 className={cn("font-semibold", hasPassedShipping ? "text-foreground" : "text-muted-foreground")}>Delivery</h4>
                 <p className="text-sm text-muted-foreground">Within 5 business days</p>
            </div>
            
            {/* Step 4: Item assessment */}
            <div className="relative pl-8 pb-10">
                 <TimelineDot state={isDelivered ? 'current' : isCompleted ? 'completed' : 'upcoming'} />
                <h4 className={cn("font-semibold", isCompleted ? "text-foreground" : "text-muted-foreground")}>Item assessment</h4>
                <p className="text-sm text-muted-foreground">Within 72 hours</p>
            </div>

            {/* Step 5: Payment */}
             <div className="relative pl-8">
                 <TimelineDot state={isCompleted ? 'current' : 'upcoming'} />
                <h4 className="text-muted-foreground">Payment</h4>
                <p className="text-sm text-muted-foreground">Within 1 business day</p>
            </div>
        </div>
    )
}

