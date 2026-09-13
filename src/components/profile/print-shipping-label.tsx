'use client';

import * as React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Printer } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/CurrencyContext';
import { buildShippingLabel, shippingLabelHtml, type LabelParty } from '@/lib/shipping-label';
import { printHtmlDocument } from '@/lib/print-document';
import { toDate } from '@/lib/defaults';
import type { FirestoreOrder } from '@/lib/types';

/**
 * Rendered by the seller timeline's own cards — the preparation card from
 * "Start preparation" through `prepared`, and the shipped card after that, so
 * a smudged label can be reprinted without moving the order's state. One
 * button per stage, always in the card the seller is already reading.
 */
/** The name the app shows for an account, in the app's own order of preference. */
function partyFrom(data: Record<string, unknown> | null | undefined, fallbackName: string): LabelParty {
  const pick = (key: string) => {
    const v = data?.[key];
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  };
  const email = pick('email');
  return { name: pick('name') || pick('displayName') || email || fallbackName, email: email || undefined };
}

/**
 * Prints the label for one seller's package.
 *
 * The two names are read at click time with `getDoc` rather than through
 * `useDoc`: this needs them once, and two live listeners on every sale page
 * to print the occasional label is a poor trade. A read that fails falls
 * back to the delivery address rather than blocking the print — a label with
 * one name missing is still a usable label.
 */
export function PrintShippingLabel({
  order,
  sellerId,
  className,
}: {
  order: FirestoreOrder;
  sellerId: string | undefined;
  className?: string;
}) {
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const handlePrint = async () => {
    if (!firestore || !sellerId || busy) return;
    setBusy(true);
    try {
      const read = (uid: string) =>
        getDoc(doc(firestore, 'users', uid))
          .then((snap) => (snap.exists() ? (snap.data() as Record<string, unknown>) : null))
          .catch(() => null);

      const [sellerDoc, buyerDoc] = await Promise.all([read(sellerId), read(order.buyerId)]);

      const model = buildShippingLabel({
        order,
        sellerId,
        seller: partyFrom(sellerDoc, 'Seller'),
        buyer: partyFrom(buyerDoc, order.shippingAddress?.fullName || 'Buyer'),
        placedAt: toDate(order.createdAt),
      });

      await printHtmlDocument(shippingLabelHtml(model, formatPrice));
    } catch (err) {
      console.error('[shipping-label] print failed', err);
      toast({
        variant: 'destructive',
        title: 'Could not open the print dialog',
        description: 'Check that your browser allows printing from this page, then try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" className={className} size="lg" onClick={handlePrint} disabled={busy || !sellerId}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
      Print shipping label
    </Button>
  );
}
