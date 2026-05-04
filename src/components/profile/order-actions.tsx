'use client';

import * as React from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, XCircle, RotateCcw } from 'lucide-react';
import type { FirestoreOrder } from '@/lib/types';
import { notifyOrderStatus, notifyUser } from '@/lib/notifications';

const CANCEL_REASONS = [
  'Changed my mind',
  'Found a better price',
  'Ordered by mistake',
  'Shipping is taking too long',
  'Other',
];

const REFUND_REASONS = [
  'Item not as described',
  'Item arrived damaged',
  'Wrong item received',
  'Item never arrived',
  'No longer needed',
  'Other',
];

// Statuses where the customer can still cancel before the item ships.
const CANCELLABLE = new Set(['processing', 'in_preparation', 'prepared']);

export function OrderCustomerActions({ order }: { order: FirestoreOrder }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [refundReason, setRefundReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const canCancel = CANCELLABLE.has(order.status);
  const canRefund = order.status === 'delivered' || order.status === 'completed';
  const alreadyRequestedCancel = order.status === 'cancel_requested';
  const alreadyRequestedRefund = order.status === 'refund_requested';
  const isTerminal = order.status === 'cancelled' || order.status === 'refunded';

  const handleSubmit = async (kind: 'cancel' | 'refund') => {
    if (!firestore || !user) return;
    const reason = kind === 'cancel' ? cancelReason : refundReason;
    if (!reason) {
      toast({ variant: 'destructive', title: 'Please pick a reason' });
      return;
    }
    setSubmitting(true);
    try {
      const updates: Record<string, any> =
        kind === 'cancel'
          ? {
              status: 'cancel_requested',
              cancellationReason: reason,
              cancelRequestedBy: user.uid,
              updatedAt: serverTimestamp(),
            }
          : {
              status: 'refund_requested',
              refundReason: reason,
              refundRequestedBy: user.uid,
              updatedAt: serverTimestamp(),
            };
      await updateDoc(doc(firestore, 'orders', order.id), updates);

      // Notify each seller in this order.
      const link = `/profile/listings/sales/${order.id}`;
      const notifyTitle =
        kind === 'cancel'
          ? `Cancellation requested for #${order.orderNumber}`
          : `Refund requested for #${order.orderNumber}`;
      await Promise.all(
        Array.from(new Set(order.sellerIds || [])).map((sellerId) =>
          notifyUser({
            firestore,
            userId: sellerId,
            title: notifyTitle,
            message: `Reason: ${reason}`,
            type: 'order_update',
            link,
          }),
        ),
      );

      toast({
        title: kind === 'cancel' ? 'Cancellation requested' : 'Refund requested',
        description: 'An admin will review your request shortly.',
      });
      kind === 'cancel' ? setCancelOpen(false) : setRefundOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not submit your request', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isTerminal) return null;

  return (
    <div className="bg-background p-4 rounded-lg space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Need help with this order?
      </h2>

      {alreadyRequestedCancel && (
        <p className="text-sm text-muted-foreground">
          Cancellation request submitted. We'll email you once it's reviewed.
        </p>
      )}
      {alreadyRequestedRefund && (
        <p className="text-sm text-muted-foreground">
          Refund request submitted. We'll email you once it's reviewed.
        </p>
      )}

      {canCancel && !alreadyRequestedCancel && (
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setCancelOpen(true)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Request cancellation
        </Button>
      )}

      {canRefund && !alreadyRequestedRefund && (
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setRefundOpen(true)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Request refund
        </Button>
      )}

      {/* Cancellation dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request cancellation</DialogTitle>
            <DialogDescription>
              Tell us why you'd like to cancel. The seller will be notified and an admin will review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">Reason</Label>
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button onClick={() => handleSubmit('cancel')} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request refund</DialogTitle>
            <DialogDescription>
              Pick the reason that best matches your situation. We may ask for photos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">Reason</Label>
            <Select value={refundReason} onValueChange={setRefundReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>Back</Button>
            <Button onClick={() => handleSubmit('refund')} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
