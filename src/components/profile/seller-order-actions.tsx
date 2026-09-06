'use client';

import * as React from 'react';
import { addDoc, collection, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Package, PackageCheck, Truck } from 'lucide-react';
import type { FirestoreOrder } from '@/lib/types';
import { notifyOrderStatus, notifyUser } from '@/lib/notifications';
import { notifyOrderEmail } from '@/lib/order-notify';
import { nextSellerTransition, statusLabel } from '@/lib/order-status';

const ICONS: Record<string, any> = {
  in_preparation: Package,
  prepared: PackageCheck,
  shipped: Truck,
};

const SELLER_CANCEL_REASONS = [
  "I don't have the product anymore",
  'I am out of town',
  'Other',
];

const CANCELLATION_FEE = 1.5;

// The seller-side cancel request is only offered before they've actually
// started preparing the order — i.e. the very first step.
const CAN_REQUEST_CANCEL = new Set(['confirmed', 'processing']);

function SellerCancelRequest({ order }: { order: FirestoreOrder }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'confirm' | 'reason' | 'done'>('confirm');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const reset = () => {
    setStep('confirm');
    setReason('');
    setSubmitting(false);
  };

  const close = () => {
    setOpen(false);
    // Defer reset so the dialog closes smoothly before content swaps.
    setTimeout(reset, 200);
  };

  const handleSubmit = async () => {
    if (!firestore || !user || !reason) return;
    setSubmitting(true);
    try {
      // 1. Persist a dispute so it surfaces in admin /admin/disputes.
      const sellerName = user.displayName || user.email || 'Seller';
      const firstItem = order.items?.[0];
      await addDoc(collection(firestore, 'disputes'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        buyerName: '',
        sellerId: user.uid,
        sellerName,
        reason: `Seller cancellation request: ${reason}`,
        status: 'open',
        source: 'seller_cancel_request',
        cancellationFee: CANCELLATION_FEE,
        productId: firstItem?.id || null,
        productTitle: firstItem?.title || null,
        productImage: firstItem?.image || null,
        messages: [
          {
            senderId: user.uid,
            senderName: sellerName,
            senderRole: 'seller',
            content: `I would like to cancel this sale. Reason: ${reason}.`,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: serverTimestamp(),
      });

      // 2. Flag the order so the buyer page reflects the pending request.
      await updateDoc(doc(firestore, 'orders', order.id), {
        sellerCancelRequested: true,
        sellerCancelReason: reason,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: 'seller_cancel_requested',
          at: new Date().toISOString(),
          by: user.uid,
        }),
      });

      // 3. Best-effort notifications. Admin watches /admin/disputes; the
      // buyer should still see something in their bell.
      notifyUser({
        firestore,
        userId: order.buyerId,
        title: `${firstItem?.title || `#${order.orderNumber}`} — Cancellation requested by seller`,
        message: 'The seller asked to cancel this order. An admin is reviewing the request.',
        type: 'order_update',
        link: `/profile/orders/${order.id}`,
        imageUrl: firstItem?.image,
      }).catch(() => null);

      setStep('done');
    } catch (err) {
      console.error('[seller cancel request] failed', err);
      toast({ variant: 'destructive', title: 'Could not submit your request' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="block mx-auto mt-3 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        Cancel sale request
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          {step === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Cancel this sale?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel this order? Cancellations have a cost of €
                  {CANCELLATION_FEE.toFixed(2)}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('reason')}>Continue</Button>
              </DialogFooter>
            </>
          )}

          {step === 'reason' && (
            <>
              <DialogHeader>
                <DialogTitle>Why do you need to cancel this order?</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label className="text-sm">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_CANCEL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setStep('confirm')}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={!reason || submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'done' && (
            <>
              <DialogHeader>
                <DialogTitle>Request received</DialogTitle>
                <DialogDescription>
                  We have received your cancellation request and will review it within 12 hours.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={close}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SellerOrderActions({ order }: { order: FirestoreOrder }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const transition = nextSellerTransition(order.status);
  const isCancelRequested = order.status === 'cancel_requested';
  const isRefundRequested = order.status === 'refund_requested';
  const canRequestCancel = CAN_REQUEST_CANCEL.has(order.status) && !order.sellerCancelRequested;

  const handleAdvance = async () => {
    if (!firestore || !transition) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: transition.status,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: transition.status,
          at: new Date().toISOString(),
          by: user?.uid || 'seller',
        }),
      });

      toast({
        title: 'Status updated',
        description: `Order is now ${statusLabel(transition.status, 'seller')}.`,
      });
    } catch (err) {
      console.error('[seller-order-actions] update failed', err);
      toast({ variant: 'destructive', title: 'Could not update status' });
      setSubmitting(false);
      return;
    }

    // Buyer's email for "shipped"; the route ignores the other steps.
    void notifyOrderEmail(user, { orderId: order.id, status: transition.status });

    const firstItem = order.items?.[0];
    const productTitle = firstItem?.title;
    const productImage = firstItem?.image;
    notifyOrderStatus({
      firestore,
      userId: order.buyerId,
      orderNumber: order.orderNumber,
      status: transition.status,
      link: `/profile/orders/${order.id}`,
      audience: 'buyer',
      productTitle,
      productImage,
    }).catch(() => null);
    Array.from(new Set(order.sellerIds || [])).forEach((sellerId) => {
      notifyOrderStatus({
        firestore,
        userId: sellerId,
        orderNumber: order.orderNumber,
        status: transition.status,
        link: `/profile/listings/sales/${order.id}`,
        audience: 'seller',
        productTitle,
        productImage,
      }).catch(() => null);
    });

    setSubmitting(false);
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
  const Icon = ICONS[transition.status] || Package;

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

      {canRequestCancel && <SellerCancelRequest order={order} />}
      {order.sellerCancelRequested && (
        <p className="text-center text-xs text-muted-foreground pt-2">
          Cancellation request submitted. An admin will review it within 12 hours.
        </p>
      )}
    </div>
  );
}
