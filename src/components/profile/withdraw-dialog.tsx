'use client';

/**
 * The seller's withdrawal form.
 *
 * Money leaves Marigo as a bank transfer made by hand, so this writes a row
 * to `payout_requests` and stops. Nothing here moves funds; an operator picks
 * the request up on /admin/payouts, transfers, and marks it paid.
 *
 * The bank details are typed each time rather than stored on the profile —
 * see the note on `FirestorePayoutRequest`. All the decisions (the floor,
 * whether a request is allowed at all, what counts as a valid IBAN) come from
 * `src/lib/payouts.ts` so this form and the wallet behind it cannot disagree
 * about whether the seller may withdraw.
 */

import * as React from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Banknote, ShieldCheck } from 'lucide-react';
import { omitUndefined } from '@/lib/firestore-write';
import {
  canRequestWithdrawal,
  normalizeIban,
  validateBankDetails,
  type BankDetails,
  type SellerBalance,
} from '@/lib/payouts';

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  sellerName,
  sellerEmail,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: SellerBalance;
  sellerName?: string;
  sellerEmail?: string;
  onSubmitted?: () => void;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();

  const [form, setForm] = React.useState<BankDetails>({
    accountHolder: '',
    iban: '',
    bankName: '',
    swift: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof BankDetails, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Clear the account details when the sheet closes. They are not kept
  // anywhere, so leaving them in component state after a successful request
  // would be the one place they linger.
  React.useEffect(() => {
    if (!open) {
      setForm({ accountHolder: '', iban: '', bankName: '', swift: '' });
      setErrors({});
    }
  }, [open]);

  const gate = canRequestWithdrawal(balance);

  const set = (key: keyof BankDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    const check = validateBankDetails(form);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    // Re-checked at submit, not only at render: the balance is live, and an
    // order refunded while this form was open can take the seller back under
    // the floor.
    if (!gate.ok) {
      toast({ variant: 'destructive', title: 'That withdrawal is no longer available.' });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(
        collection(firestore, 'payout_requests'),
        omitUndefined({
          sellerId: user.uid,
          sellerName: sellerName || user.displayName || undefined,
          sellerEmail: sellerEmail || user.email || undefined,
          amount: balance.available,
          status: 'pending',
          bank: omitUndefined({
            accountHolder: form.accountHolder.trim(),
            iban: normalizeIban(form.iban),
            bankName: form.bankName.trim(),
            swift: form.swift?.trim() ? form.swift.trim().toUpperCase() : undefined,
          }),
          balanceSnapshot: {
            available: balance.available,
            clearing: balance.clearing,
            pending: balance.pending,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      toast({
        title: 'Withdrawal requested',
        description: 'We will review it and transfer the money to your account.',
      });
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not send the request',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h/overflow because the form is taller than a phone viewport, and
          a DialogContent has neither by default — the submit button ends up
          off-screen with no way to reach it. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Withdraw your earnings</DialogTitle>
          <DialogDescription>
            We will transfer {formatPrice(balance.available)} to your bank account. Transfers are made by
            hand, usually within a few working days.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-emerald-50/60 p-3 flex items-start gap-3">
          <Banknote className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">{formatPrice(balance.available)}</p>
            <p className="text-xs text-emerald-800/80">
              Your full available balance. You cannot withdraw part of it.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="accountHolder">Account holder</Label>
            <Input
              id="accountHolder"
              value={form.accountHolder}
              onChange={set('accountHolder')}
              placeholder="The name on the account"
              autoComplete="off"
            />
            {errors.accountHolder && <p className="text-xs text-destructive">{errors.accountHolder}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={form.iban}
              onChange={set('iban')}
              placeholder="AL35 2021 1109 0000 0000 0123 4567"
              autoComplete="off"
              spellCheck={false}
            />
            {errors.iban && <p className="text-xs text-destructive">{errors.iban}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank</Label>
            <Input
              id="bankName"
              value={form.bankName}
              onChange={set('bankName')}
              placeholder="Your bank's name"
              autoComplete="off"
            />
            {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="swift">
              SWIFT / BIC <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="swift"
              value={form.swift}
              onChange={set('swift')}
              placeholder="Only needed for a bank outside Albania"
              autoComplete="off"
              spellCheck={false}
            />
            {errors.swift && <p className="text-xs text-destructive">{errors.swift}</p>}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-3.5 w-3.5 mt-px shrink-0" />
          Your account details are used for this transfer only and are not saved to your profile.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !gate.ok}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request {formatPrice(balance.available)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
