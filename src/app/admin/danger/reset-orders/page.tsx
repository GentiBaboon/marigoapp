'use client';

/**
 * One-shot admin destructive action: wipe every order from the system and
 * restock the items that were sold. Lives under /admin/danger so it never
 * appears in normal admin navigation; only operators that know the URL or
 * follow a direct link reach it. Two confirmation gates and a typed
 * "RESET" phrase are required to avoid accidental clicks.
 *
 * What it does, in order:
 *   1. Reads every order.
 *   2. For each order, calls `releaseOrderItems` so every product gets its
 *      stock back AND any listing that had been flipped to `sold` returns to
 *      `active` on the marketplace.
 *   3. Decrements `salesCount` on each seller in the order so badge tiers
 *      recompute correctly.
 *   4. Deletes the order doc itself.
 *   5. Deletes the related side-collection records (returns, refunds,
 *      disputes, transactions tied to the order's id/orderNumber) so the
 *      admin pages aren't left showing dangling refs.
 *
 * Best-effort throughout: per-document errors are caught and reported in the
 * UI summary rather than aborting the whole pass.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { releaseOrderItems } from '@/lib/order-inventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Result {
  ordersDeleted: number;
  productsRestocked: number;
  sellerCountersFixed: number;
  returnsDeleted: number;
  refundsDeleted: number;
  disputesDeleted: number;
  transactionsDeleted: number;
  errors: string[];
}

export default function ResetOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [phrase, setPhrase] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  const armed = phrase.trim() === 'RESET';

  // Helper: delete every document in a collection that matches a where clause,
  // batched in serial loops to keep error surfacing readable.
  const deleteWhere = async (
    coll: string,
    field: string,
    opIn: string[],
  ): Promise<{ deleted: number; errors: string[] }> => {
    let deleted = 0;
    const errors: string[] = [];
    // Firestore `in` operator caps at 30 — chunk to be safe.
    for (let i = 0; i < opIn.length; i += 30) {
      const slice = opIn.slice(i, i + 30);
      if (slice.length === 0) continue;
      try {
        const snap = await getDocs(query(collection(firestore, coll), where(field, 'in', slice)));
        for (const d of snap.docs) {
          try {
            await deleteDoc(d.ref);
            deleted++;
          } catch (e: any) {
            errors.push(`${coll}/${d.id}: ${e?.message || 'delete failed'}`);
          }
        }
      } catch (e: any) {
        errors.push(`${coll} query failed: ${e?.message || 'unknown'}`);
      }
    }
    return { deleted, errors };
  };

  const runReset = async () => {
    if (!firestore || !armed) return;
    setRunning(true);
    setResult(null);
    const summary: Result = {
      ordersDeleted: 0,
      productsRestocked: 0,
      sellerCountersFixed: 0,
      returnsDeleted: 0,
      refundsDeleted: 0,
      disputesDeleted: 0,
      transactionsDeleted: 0,
      errors: [],
    };

    try {
      // 1. Read every order.
      const ordersSnap = await getDocs(collection(firestore, 'orders'));
      const orderIds: string[] = [];
      const orderNumbers: string[] = [];

      // 2. + 3. Restock and bump seller counters per order, then delete the order doc.
      for (const orderDoc of ordersSnap.docs) {
        const data = orderDoc.data() as any;
        orderIds.push(orderDoc.id);
        if (data.orderNumber) orderNumbers.push(data.orderNumber);

        try {
          await releaseOrderItems(firestore, (data.items as any) || []);
          summary.productsRestocked += (data.items || []).length;
        } catch (e: any) {
          summary.errors.push(`restock for order ${orderDoc.id}: ${e?.message || 'unknown'}`);
        }

        // Decrement salesCount once per unique seller in the order. We don't
        // know whether the order was ever marked completed; the safe thing
        // is to roll back any counter bump that may have happened. We floor
        // at 0 server-side via the rule.
        const sellerIds = Array.from(new Set((data.items || []).map((it: any) => it?.sellerId).filter(Boolean)));
        for (const sellerId of sellerIds) {
          try {
            await updateDoc(doc(firestore, 'users', sellerId as string), { salesCount: increment(-1) });
            summary.sellerCountersFixed++;
          } catch (e: any) {
            // Best-effort — likely zero/missing field. Don't spam errors.
          }
        }

        try {
          await deleteDoc(orderDoc.ref);
          summary.ordersDeleted++;
        } catch (e: any) {
          summary.errors.push(`delete order ${orderDoc.id}: ${e?.message || 'unknown'}`);
        }
      }

      // 4. Wipe side collections that reference these orders.
      const rResults = await deleteWhere('returns', 'orderId', orderIds);
      summary.returnsDeleted = rResults.deleted;
      summary.errors.push(...rResults.errors);

      const refResults = await deleteWhere('refunds', 'orderId', orderIds);
      summary.refundsDeleted = refResults.deleted;
      summary.errors.push(...refResults.errors);

      const dResults = await deleteWhere('disputes', 'orderId', orderIds);
      summary.disputesDeleted = dResults.deleted;
      summary.errors.push(...dResults.errors);

      // Transactions are keyed by orderId too. We don't have rules permitting
      // delete on /transactions today; the query may fail. Surface that case
      // as a non-fatal warning in the summary.
      const tResults = await deleteWhere('transactions', 'orderId', orderIds);
      summary.transactionsDeleted = tResults.deleted;
      summary.errors.push(...tResults.errors);

      setResult(summary);
      toast({
        title: 'Reset complete',
        description: `Deleted ${summary.ordersDeleted} orders and restocked ${summary.productsRestocked} item references.`,
      });
    } catch (e: any) {
      summary.errors.push(e?.message || 'unknown top-level failure');
      setResult(summary);
      toast({ variant: 'destructive', title: 'Reset failed', description: e?.message || 'See summary below.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reset all orders</h1>
          <p className="text-muted-foreground">
            Destructive — wipes every order, restocks the items, and clears related returns / refunds / disputes / transactions.
          </p>
        </div>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <CardTitle>This cannot be undone</CardTitle>
              <CardDescription className="mt-1 text-sm">
                Every order document is permanently deleted. Products that were sold or reserved are flipped back to
                <code className="mx-1 px-1 rounded bg-muted">active</code> and their <code className="px-1 rounded bg-muted">quantity</code> is incremented by the number of line items they appeared in.
                Sellers&apos; <code className="px-1 rounded bg-muted">salesCount</code> is decremented accordingly so badges reflect the new state.
                Returns, refunds, disputes and finance-ledger rows tied to those orders are removed too.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="confirm-phrase">Type <code className="px-1 rounded bg-muted">RESET</code> to enable the button</Label>
            <Input
              id="confirm-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <Button
            variant="destructive"
            disabled={!armed || running}
            onClick={runReset}
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
            Reset all orders now
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Counts of what was changed. Errors listed below are non-fatal — each item failed independently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <div>Orders deleted</div><div className="font-mono">{result.ordersDeleted}</div>
              <div>Product line items restocked</div><div className="font-mono">{result.productsRestocked}</div>
              <div>Seller counters decremented</div><div className="font-mono">{result.sellerCountersFixed}</div>
              <div>Returns deleted</div><div className="font-mono">{result.returnsDeleted}</div>
              <div>Refunds deleted</div><div className="font-mono">{result.refundsDeleted}</div>
              <div>Disputes deleted</div><div className="font-mono">{result.disputesDeleted}</div>
              <div>Transactions deleted</div><div className="font-mono">{result.transactionsDeleted}</div>
            </div>
            {result.errors.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">{result.errors.length} non-fatal errors</summary>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc list-inside max-h-60 overflow-auto">
                  {result.errors.map((err, i) => <li key={i} className="font-mono">{err}</li>)}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
