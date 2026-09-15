'use client';

/**
 * /admin/payouts — the seller withdrawal queue.
 *
 * Its own page rather than a tab inside Finance because it is a work queue an
 * operator clears, not a report they read: every row here is a bank transfer
 * somebody has to actually make, and the count of pending rows is a to-do
 * list.
 *
 * Nothing on this page moves money. An operator reads the account details,
 * makes the transfer in their banking app, and records the outcome here. The
 * three actions map to that: **Approve** claims the row ("I am doing this
 * one"), **Mark paid** records the completed transfer and its reference, and
 * **Decline** returns the money to the seller's available balance with a note
 * explaining why.
 *
 * Amounts stay EUR, like the rest of finance — the ledger reconciles in euro
 * and an operator comparing a lek row against a euro dashboard is how
 * mistakes happen. The seller sees their own currency on their wallet.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, limit, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { FirestorePayoutRequest } from '@/lib/types';
import { toDate } from '@/lib/types';
import { newestFirst } from '@/lib/order-money';
import { normalizeIban, PAYOUT_STATUS_LABELS, type PayoutRequestStatus } from '@/lib/payouts';
import { omitUndefined } from '@/lib/firestore-write';
import { notifyUser } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Banknote,
  Check,
  Copy,
  Loader2,
  X,
  Clock,
  CheckCheck,
} from 'lucide-react';

/** Finance figures stay in euro — see the file header. */
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

const TABS: Array<{ value: 'pending' | 'approved' | 'paid' | 'rejected' | 'all'; label: string }> = [
  { value: 'pending', label: 'To review' },
  { value: 'approved', label: 'In progress' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All' },
];

const STATUS_STYLE: Record<PayoutRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  approved: 'bg-blue-100 text-blue-900 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-muted text-muted-foreground',
};

/** One field of the transfer, with a copy button — an operator is retyping
 *  an IBAN into a banking app, and a mistyped one sends a seller's money to a
 *  stranger. */
function CopyField({ label, value }: { label: string; value?: string }) {
  const { toast } = useToast();
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => toast({ title: `${label} copied` }),
            () => toast({ variant: 'destructive', title: 'Could not copy' }),
          );
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function AdminPayoutsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<(typeof TABS)[number]['value']>('pending');
  const [search, setSearch] = React.useState('');
  const [active, setActive] = React.useState<FirestorePayoutRequest | null>(null);
  const [mode, setMode] = React.useState<'paid' | 'reject' | null>(null);
  const [reference, setReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  // No orderBy: it would pair with nothing here, but the collection is small
  // and sorting in memory keeps this page working before any index exists —
  // the same reason the seller wallet does it.
  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'payout_requests'), limit(300)) : null),
    [firestore],
  );
  const { data: raw, isLoading } = useCollection<FirestorePayoutRequest>(requestsQuery);
  const requests = React.useMemo(() => newestFirst(raw, (r) => toDate(r.createdAt as any)), [raw]);

  const counts = React.useMemo(() => {
    const c = { pending: 0, approved: 0, paid: 0, rejected: 0, all: (requests ?? []).length };
    for (const r of requests ?? []) {
      if (r.status in c) (c as any)[r.status] += 1;
    }
    return c;
  }, [requests]);

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return (requests ?? []).filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false;
      if (!term) return true;
      return (
        (r.sellerName ?? '').toLowerCase().includes(term) ||
        (r.sellerEmail ?? '').toLowerCase().includes(term) ||
        normalizeIban(r.bank?.iban).toLowerCase().includes(term)
      );
    });
  }, [requests, tab, search]);

  const totalPending = React.useMemo(
    () => (requests ?? []).filter((r) => r.status === 'pending').reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [requests],
  );

  const decide = async (
    row: FirestorePayoutRequest,
    status: PayoutRequestStatus,
    extra?: { transferReference?: string; adminNote?: string },
  ) => {
    if (!firestore || !user) return;
    setBusy(row.id);
    try {
      await updateDoc(
        doc(firestore, 'payout_requests', row.id),
        omitUndefined({
          status,
          decidedBy: user.uid,
          decidedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          transferReference: extra?.transferReference || undefined,
          adminNote: extra?.adminNote || undefined,
        }),
      );

      // A payout is a money movement, so it belongs in the append-only ledger
      // the finance page reads — but only once the transfer really happened.
      // Approving is an operator claiming the row, not money leaving.
      if (status === 'paid') {
        await addDoc(
          collection(firestore, 'transactions'),
          omitUndefined({
            type: 'payout',
            orderId: '',
            orderNumber: `PAYOUT-${row.id.slice(0, 8).toUpperCase()}`,
            userId: row.sellerId,
            amount: Number(row.amount) || 0,
            commission: 0,
            sellerPayout: Number(row.amount) || 0,
            paymentMethod: 'bank_transfer',
            note: extra?.transferReference ? `Bank transfer ${extra.transferReference}` : 'Bank transfer',
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          }),
        ).catch((err) => {
          // The payout itself is recorded; a missing ledger row is a
          // reporting gap, not a reason to tell the operator the transfer
          // failed after they have already sent the money.
          console.error('[payouts] ledger row failed:', err);
        });
      }

      // Fire-and-forget: notifyUser never throws, and a missing bell entry
      // must not make a completed transfer look like it failed.
      notifyUser({
        firestore,
        userId: row.sellerId,
        title:
          status === 'paid'
            ? 'Your withdrawal has been sent'
            : status === 'rejected'
              ? 'Your withdrawal was declined'
              : 'Your withdrawal was approved',
        message:
          status === 'paid'
            ? `We have transferred ${eur.format(Number(row.amount) || 0)} to your bank account.`
            : status === 'rejected'
              ? extra?.adminNote || 'Please check your details and try again.'
              : 'We are preparing your bank transfer.',
        type: 'default',
        link: '/profile/wallet',
      });

      toast({ title: `Marked ${PAYOUT_STATUS_LABELS[status].toLowerCase()}` });
      setActive(null);
      setMode(null);
      setReference('');
      setNote('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not update', description: err?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="md:hidden">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Payouts
          </h1>
          <p className="text-sm text-muted-foreground">
            Sellers asking to be paid out. Make the transfer, then record it here.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5" /> Waiting for review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Owed on those requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{eur.format(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> Paid all time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.paid}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {(counts as any)[t.value] > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{(counts as any)[t.value]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search seller or IBAN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {tab === 'pending' ? 'Nothing waiting. Everything is settled.' : 'No requests here.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const at = toDate(r.createdAt as any);
            const status = r.status as PayoutRequestStatus;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.sellerName || 'Marigo seller'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.sellerEmail || r.sellerId}
                        {at ? ` · ${format(at, 'd MMM yyyy, HH:mm')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={STATUS_STYLE[status]}>
                        {PAYOUT_STATUS_LABELS[status] ?? status}
                      </Badge>
                      <p className="text-lg font-bold tabular-nums">{eur.format(Number(r.amount) || 0)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 px-3 divide-y">
                    <CopyField label="Account holder" value={r.bank?.accountHolder} />
                    <CopyField label="IBAN" value={normalizeIban(r.bank?.iban)} />
                    <CopyField label="Bank" value={r.bank?.bankName} />
                    <CopyField label="SWIFT / BIC" value={r.bank?.swift} />
                  </div>

                  {r.transferReference && (
                    <p className="text-xs text-muted-foreground">Reference: {r.transferReference}</p>
                  )}
                  {r.adminNote && <p className="text-xs text-muted-foreground italic">{r.adminNote}</p>}

                  {(status === 'pending' || status === 'approved') && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => decide(r, 'approved')}
                        >
                          {busy === r.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={busy === r.id}
                        onClick={() => {
                          setActive(r);
                          setMode('paid');
                        }}
                      >
                        <Banknote className="mr-2 h-3.5 w-3.5" />
                        Mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy === r.id}
                        onClick={() => {
                          setActive(r);
                          setMode('reject');
                        }}
                      >
                        <X className="mr-2 h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mark paid / decline both need a sentence from the operator, so they
          go through a dialog rather than a bare button. */}
      <Dialog
        open={!!active && !!mode}
        onOpenChange={(o) => {
          if (!o) {
            setActive(null);
            setMode(null);
            setReference('');
            setNote('');
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'paid' ? 'Record the transfer' : 'Decline this withdrawal'}</DialogTitle>
            <DialogDescription>
              {mode === 'paid' ? (
                <>
                  Confirm you have sent {active ? eur.format(Number(active.amount) || 0) : ''} to{' '}
                  {active?.bank?.accountHolder}. The seller is notified and the amount leaves their balance.
                </>
              ) : (
                <>The amount returns to the seller&apos;s available balance. Tell them why.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === 'paid' ? (
            <div className="space-y-1.5">
              <Label htmlFor="reference">Bank reference (optional)</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="The reference from your banking app"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="note">Reason</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. The IBAN does not match the account holder's name."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setActive(null);
                setMode(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!!busy || (mode === 'reject' && note.trim().length < 3)}
              className={mode === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={mode === 'reject' ? 'destructive' : 'default'}
              onClick={() => {
                if (!active) return;
                if (mode === 'paid') decide(active, 'paid', { transferReference: reference.trim() });
                else decide(active, 'rejected', { adminNote: note.trim() });
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'paid' ? 'Mark as paid' : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
