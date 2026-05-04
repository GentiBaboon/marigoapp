'use client';

import * as React from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Package, PackageCheck, Truck } from 'lucide-react';
import type { FirestoreOrder } from '@/lib/types';
import { notifyOrderStatus, humanReadableStatus } from '@/lib/notifications';

// Maps the current status → the next allowed status the seller can move to.
const NEXT: Record<string, { status: string; label: string; icon: any }> = {
  processing: { status: 'in_preparation', label: 'Start preparing', icon: Package },
  in_preparation: { status: 'prepared', label: 'Mark as prepared', icon: PackageCheck },
  prepared: { status: 'shipped', label: 'Mark as shipped', icon: Truck },
};

export function SellerOrderActions({ order }: { order: FirestoreOrder }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const transition = NEXT[order.status];
  const isCancelRequested = order.status === 'cancel_requested';
  const isRefundRequested = order.status === 'refund_requested';

  const handleAdvance = async () => {
    if (!firestore || !transition) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: transition.status,
        updatedAt: serverTimestamp(),
      });

      // Tell the buyer the order moved forward.
      await notifyOrderStatus({
        firestore,
        userId: order.buyerId,
        orderNumber: order.orderNumber,
        status: transition.status,
        link: `/profile/orders/${order.id}`,
        audience: 'buyer',
      });

      toast({
        title: 'Status updated',
        description: `Order is now ${humanReadableStatus(transition.status)}.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update status' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isCancelRequested) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <p className="font-semibold text-amber-900">Cancellation requested by the buyer</p>
        {order.cancellationReason && (
          <p className="mt-1 text-amber-800">Reason: {order.cancellationReason}</p>
        )}
        <p className="mt-2 text-amber-800/80 text-xs">An admin will review this request.</p>
      </div>
    );
  }

  if (isRefundRequested) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <p className="font-semibold text-amber-900">Refund requested by the buyer</p>
        {order.refundReason && <p className="mt-1 text-amber-800">Reason: {order.refundReason}</p>}
        <p className="mt-2 text-amber-800/80 text-xs">An admin will review this request.</p>
      </div>
    );
  }

  if (!transition) return null;
  const Icon = transition.icon;

  return (
    <div className="bg-background p-4 rounded-lg space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Fulfillment
      </h2>
      <Button className="w-full" size="lg" onClick={handleAdvance} disabled={submitting}>
        {submitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {transition.label}
      </Button>
    </div>
  );
}
