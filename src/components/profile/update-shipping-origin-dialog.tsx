'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection } from 'firebase/firestore';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/CurrencyContext';
import { cn } from '@/lib/utils';
import type { FirestoreAddress, FirestoreOrder } from '@/lib/types';

/**
 * Change where a placed order ships from.
 *
 * "Update shipping details" and the pencil beside the address were both inert
 * buttons on the preparation card. They now open this.
 *
 * The seller picks from their own address book — the choice is an address id,
 * never a typed city, so `/api/orders/shipping-origin` can verify they hold
 * it. That route re-prices delivery, because a move across the border takes a
 * 200 ALL run to 500, and it is the buyer who pays the difference at the
 * door. Whatever it answers is what the toast reports: this component never
 * computes money.
 */
export function UpdateShippingOriginDialog({
  order,
  currentAddressId,
  children,
}: {
  order: FirestoreOrder;
  currentAddressId?: string;
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | undefined>(currentAddressId);
  const [saving, setSaving] = React.useState(false);

  const addressesRef = useMemoFirebase(
    () => (firestore && user?.uid ? collection(firestore, 'users', user.uid, 'addresses') : null),
    [firestore, user?.uid],
  );
  const { data: addresses, isLoading } = useCollection<FirestoreAddress>(addressesRef);

  // Re-seed when the dialog opens: the order may have been changed elsewhere,
  // and a stale selection would quietly re-send the old address.
  React.useEffect(() => {
    if (open) setSelected(currentAddressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id);
  }, [open, currentAddressId, addresses]);

  const save = async () => {
    if (!user || !selected || saving) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/orders/shipping-origin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, addressId: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not update the pickup address.');

      toast({
        title: 'Pickup address updated',
        description: data.totalChanged
          ? `Delivery is now ${formatPrice(data.shippingFee)} — the buyer's total is ${formatPrice(data.total)}.`
          : `We will collect from ${data.city}.`,
      });
      setOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Not updated', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Where are we collecting from?</DialogTitle>
          <DialogDescription>
            Pick the address the driver should come to. Changing the city can change the delivery
            fee on this order.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !addresses?.length ? (
          <p className="py-4 text-sm text-muted-foreground">
            You have no saved addresses yet. Add one and it will show up here.
          </p>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
            {addresses.map((a) => (
              <Label
                key={a.id}
                htmlFor={`origin-${a.id}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary',
                  selected === a.id && 'border-primary bg-primary/5',
                )}
              >
                <RadioGroupItem value={a.id} id={`origin-${a.id}`} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block font-semibold">{a.fullName}</span>
                  <span className="block text-muted-foreground">
                    {[a.address, a.apartment].filter(Boolean).join(', ')}
                  </span>
                  <span className="block text-muted-foreground">
                    {[a.postal, a.city].filter(Boolean).join(' ')}, {a.country}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" asChild className="sm:mr-auto">
            <Link href="/profile/addresses">
              <Plus className="mr-2 h-4 w-4" />
              Add an address
            </Link>
          </Button>
          <Button onClick={save} disabled={!selected || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            Save pickup address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
