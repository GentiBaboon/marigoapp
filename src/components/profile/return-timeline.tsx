'use client';

import * as React from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, PackageCheck, Truck, Clock, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { FirestoreReturn } from '@/lib/types';
import { toDate } from '@/lib/types';

// The four buyer-visible steps of the return flow. We map each Return.status
// value to a step rank so the timeline shows the right "current" state.
type Step = 'initiated' | 'ready' | 'shipped' | 'delivered';

const STEP_LABELS: Record<Step, string> = {
  initiated: 'Return Initiated',
  ready: 'Return Package Ready',
  shipped: 'Return Package Shipped',
  delivered: 'Return Package Delivered',
};

const STEPS: Step[] = ['initiated', 'ready', 'shipped', 'delivered'];

// Map a Return.status to the rank of the step it represents (0..3).
function rankOf(status: string): number {
  switch (status) {
    case 'approved':
    case 'requested':
      return 0; // Return Initiated
    case 'ready_for_pickup':
      return 1; // Return Package Ready
    case 'shipping':
      return 2; // Return Package Shipped
    case 'received':
    case 'refunded':
    case 'exchanged':
      return 3; // Return Package Delivered
    default:
      return 0;
  }
}

const TimelineDot = ({ state }: { state: 'completed' | 'current' | 'upcoming' }) => (
  <div
    className={cn(
      'absolute left-0 top-1 h-4 w-4 rounded-full bg-background flex items-center justify-center -translate-x-[calc(50%-1px)]',
      { 'z-10': state === 'current' },
    )}
  >
    <div
      className={cn('h-full w-full rounded-full', {
        'bg-green-500': state === 'completed',
        'bg-blue-500 ring-4 ring-blue-200': state === 'current',
        'border-2 border-gray-300 bg-background': state === 'upcoming',
      })}
    />
  </div>
);

interface ReturnTimelineProps {
  returnDoc: FirestoreReturn;
  /** Who's viewing — drives whether the "Package ready for pickup" action
   *  appears (buyer-only) and whether the instructions text speaks to the
   *  buyer or the seller. */
  audience: 'buyer' | 'seller' | 'admin';
}

export function ReturnTimeline({ returnDoc, audience }: ReturnTimelineProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const rank = rankOf(returnDoc.status);

  // Generic status setter for the return doc. Each audience triggers a
  // specific transition: buyer marks ready/shipped, seller marks delivered.
  // Toast wording is driven by the destination status.
  const advanceTo = async (nextStatus: 'ready_for_pickup' | 'shipping' | 'received') => {
    if (!firestore || !user) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'returns', returnDoc.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      const msg = {
        ready_for_pickup: { title: 'Marked ready for pickup', description: 'The courier will collect the package shortly.' },
        shipping: { title: 'Marked as shipped', description: 'We\'ll update this card once the package arrives.' },
        received: { title: 'Return package received', description: 'Thank you — the refund is being processed.' },
      }[nextStatus];
      toast(msg);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: e?.message || 'Could not update the return.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const createdDate = toDate(returnDoc.createdAt as any);
  const updatedDate = toDate(returnDoc.updatedAt as any);

  // Instruction copy for each audience. Pure UX — no behavior gating.
  const instructionsByAudience = {
    buyer: [
      'Pack the item back in its original packaging, including any tags.',
      'Tap "Package ready for pickup" below — a courier will be assigned within 24h.',
      'Hand the package to the courier. You\'ll see the status update here as it moves.',
      'Once we receive and inspect the item, your refund is processed automatically.',
    ],
    seller: [
      'A return is in progress for this order. The buyer is preparing the package.',
      'You\'ll see the status update here at each step — no action needed from your side.',
      'After we receive and inspect the item, the refund is booked against this sale.',
    ],
    admin: [
      'Walk this return through the steps as they happen.',
      'Once the package is marked as Delivered, process the refund from the Returns page to close out the order.',
    ],
  } as const;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-700" />
            <h3 className="font-semibold text-sm">Return in progress</h3>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-800 bg-amber-100/50 font-semibold">
            {STEP_LABELS[STEPS[rank]]}
          </Badge>
        </div>

        {/* Instructions panel */}
        <div className="flex items-start gap-2 rounded-md bg-white/60 border p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
            {instructionsByAudience[audience].map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>

        {/* Timeline */}
        <div className="relative ml-2 pt-2">
          <div className="absolute left-2 top-2 h-[calc(100%-8px)] w-0.5 bg-gray-200" />
          {STEPS.map((step, idx) => {
            const state: 'completed' | 'current' | 'upcoming' =
              rank > idx ? 'completed' : rank === idx ? 'current' : 'upcoming';
            const isLast = idx === STEPS.length - 1;
            const showDate = state === 'completed' || state === 'current';
            const date = idx === 0 ? createdDate : updatedDate;
            return (
              <div
                key={step}
                className={cn('relative pl-8', isLast ? '' : 'pb-6')}
              >
                <TimelineDot state={state} />
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={cn(
                      'font-semibold text-sm',
                      state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </h4>
                  {showDate && date && (
                    <span className="text-[11px] text-muted-foreground">
                      {format(date, 'MMM d, HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Audience-specific action buttons.
            Buyer (in possession of the item): packs it → ready for pickup at
            step 0, and confirms handoff to courier (shipped) at step 1.
            Seller (receiver of the returned package): confirms package
            delivered at step 2. Admin still drives every step from the
            /admin/returns table. */}
        {audience === 'buyer' && rank === 0 && (
          <Button onClick={() => advanceTo('ready_for_pickup')} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
            Package ready for pickup
          </Button>
        )}
        {audience === 'buyer' && rank === 1 && (
          <Button onClick={() => advanceTo('shipping')} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Mark as shipped
          </Button>
        )}
        {audience === 'seller' && rank === 2 && (
          <Button onClick={() => advanceTo('received')} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
            Return package delivered
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
