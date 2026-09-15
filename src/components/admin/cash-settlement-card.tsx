'use client';

/**
 * "Has the cash reached us?" — the operator-only switch behind seller payouts.
 *
 * On a cash-on-delivery order the buyer hands notes to a courier and the money
 * reaches Marigo later, through the logistics partner. Marking the order
 * `completed` says the buyer has the parcel; it says nothing about where the
 * cash is. Only an operator reconciling against the courier's settlement
 * knows that, and until they say so the seller's earnings are not
 * withdrawable — see `src/lib/payouts.ts`.
 *
 * Deliberately a separate card from the status control beside it. Bundling
 * settlement into "mark completed" would mean one click asserting two
 * different facts, and the second one is usually not true yet.
 *
 * The write is admin-only in `firestore.rules`: the orders update rule lets a
 * seller drive their own order, so without that carve-out a seller could
 * stamp this themselves and release their own money.
 */

import * as React from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { FirestoreOrder } from '@/lib/types';
import { toDate } from '@/lib/types';
import { isCashSettled, PAYOUT_GATE_FROM, orderCompletedAt } from '@/lib/payouts';
import { omitUndefined } from '@/lib/firestore-write';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Banknote, CheckCircle2, Loader2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';

export function CashSettlementCard({ order }: { order: FirestoreOrder }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [undoOpen, setUndoOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const stamped = toDate(order.cashSettledAt as any);
  const settled = isCashSettled(order as any);
  const isCard = order.paymentMethod === 'card';
  const completedAt = orderCompletedAt(order as any);
  const grandfathered =
    !stamped && !isCard && !!completedAt && completedAt.getTime() < PAYOUT_GATE_FROM;

  const write = async (next: boolean) => {
    if (!firestore || !user) return;
    setBusy(true);
    try {
      await updateDoc(
        doc(firestore, 'orders', order.id),
        omitUndefined({
          // `null` rather than a delete: the field is what the payout math
          // reads, and clearing it must be an explicit "no" the rules can see.
          cashSettledAt: next ? serverTimestamp() : null,
          cashSettledBy: next ? user.uid : null,
        }),
      );
      toast({
        title: next ? 'Marked as received' : 'Settlement cleared',
        description: next
          ? "The seller's earnings for this order are now withdrawable."
          : 'The earnings have gone back to waiting.',
      });
      setConfirmOpen(false);
      setUndoOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not update', description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Cash settlement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isCard ? (
            // Card money was captured into Stripe at completion, so there is
            // nothing for an operator to confirm.
            <p className="text-sm text-muted-foreground">
              Paid by card — the funds were captured at checkout, so no settlement step applies.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Money received from logistics</span>
                {stamped ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Received
                  </Badge>
                ) : grandfathered ? (
                  // Counted as received, but nobody actually checked — the
                  // badge says so rather than claiming a confirmation that
                  // never happened.
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Assumed received
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200">
                    Waiting
                  </Badge>
                )}
              </div>

              {stamped && (
                <p className="text-xs text-muted-foreground">
                  Confirmed {format(stamped, 'd MMM yyyy, HH:mm')}
                  {order.cashSettledBy ? ' by an operator' : ''}.
                </p>
              )}

              {grandfathered && (
                // Explained rather than silently true, or an operator will
                // wonder why an untouched order counts as paid.
                <p className="text-xs text-muted-foreground">
                  This order completed before settlement tracking started, so it already counts as
                  received and the seller was not made to wait. Confirm it to put it on the record.
                </p>
              )}

              {order.status !== 'completed' && !settled && (
                <p className="text-xs text-muted-foreground">
                  The order is not completed yet. You can still record the cash if it has reached us.
                </p>
              )}

              {/* There is always something to press on a cash order. A
                  grandfathered one used to render no button at all: it read as
                  settled, so the "mark received" branch was skipped, and it had
                  no stamp to undo — leaving an operator looking at a state they
                  could not act on. Confirming one is not a no-op either; it
                  replaces an assumption with a dated record of who checked. */}
              <div className="flex flex-wrap gap-2">
                {!settled || grandfathered ? (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setConfirmOpen(true)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    {grandfathered ? 'Confirm we received it' : 'Mark cash received'}
                  </Button>
                ) : null}

                {stamped ? (
                  <Button variant="outline" size="sm" onClick={() => setUndoOpen(true)} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    Undo
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm the cash reached Marigo?"
        description={
          grandfathered
            ? 'This order already counts as received because it predates settlement tracking. Confirming records who checked and when, and changes nothing about the seller\'s balance.'
            : "This releases the seller's earnings for this order into their withdrawable balance. Only do it once the logistics partner has settled with us."
        }
        actionLabel="Yes, we have the money"
        isLoading={busy}
        onConfirm={() => write(true)}
      />

      <ConfirmActionDialog
        open={undoOpen}
        onOpenChange={setUndoOpen}
        title="Clear this settlement?"
        description="The seller's earnings for this order go back to waiting. If they have already withdrawn, this will not reverse the transfer."
        actionLabel="Clear it"
        variant="destructive"
        isLoading={busy}
        onConfirm={() => write(false)}
      />
    </>
  );
}
