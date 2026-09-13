'use client';

import * as React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { openConversation } from '@/lib/open-conversation';
import type { FirestoreOrder } from '@/lib/types';

/**
 * "Contact seller" / "Contact buyer" on the two order timelines.
 *
 * Both were plain `<Button>`s with no handler — they looked like the way to
 * reach the other party and did nothing at all. One component now, because
 * the only difference between the two sides is which uid is the
 * counterparty and what the label says.
 *
 * The thread is per *product*, not per order, so it is the same conversation
 * the product page's "Contact Seller" opens: a buyer asking about an item and
 * then asking about their order should not end up in two places.
 */
export function ContactPartyButton({
  order,
  otherUserId,
  label,
  className,
  variant = 'outline',
}: {
  order: FirestoreOrder;
  otherUserId: string | undefined;
  label: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const item = order.items?.[0];

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(user, {
        productId: String(item?.id || (item as any)?.productId || ''),
        otherUserId: otherUserId || '',
        productTitle: item?.title,
        productImage: item?.image,
      });
      router.push(`/messages/${conversationId}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not open the chat', description: err?.message });
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} className={className} onClick={go} disabled={busy || !otherUserId}>
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
