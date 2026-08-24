'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

import type { OfferWithProduct } from '@/app/profile/offers/page';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';
import { toDate } from '@/lib/types';
import { awaitingParty, currentAmount, effectiveStatus, offerStatusLabel } from '@/lib/offers';

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  countered: 'bg-blue-100 text-blue-800 border-blue-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
};

export function OfferListItem({ offer }: { offer: OfferWithProduct }) {
  const { product, role } = offer;
  const { formatPrice } = useCurrency();

  const firstImage = product.images?.[0];
  const imageUrl =
    (typeof firstImage === 'string' ? firstImage : firstImage?.url) ||
    'https://placehold.co/96x96/E2E8F0/A0AEC0?text=MARIGO';

  // Expiry is folded in on read, so a lapsed offer stops advertising itself as
  // pending without anything having to write to it.
  const status = effectiveStatus(offer);
  const onTable = currentAmount({ ...offer, status });
  const yourTurn = awaitingParty(status) === role;
  const sent = toDate(offer.createdAt);

  return (
    <Link href={`/products/${product.id}/offers/${offer.id}`} className="block">
      <div
        className={cn(
          'flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50',
          yourTurn && 'border-primary/60 bg-primary/[0.03]',
        )}
      >
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground truncate">
            {role === 'seller' ? `Offer from ${offer.buyerName || 'a buyer'}` : `Your offer`}
          </span>
          <Badge className={cn(statusStyles[status] ?? statusStyles.expired, 'shrink-0')}>
            {offerStatusLabel(status, role)}
          </Badge>
        </div>
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
            <Image src={imageUrl} alt={product.title} fill className="object-cover" sizes="96px" />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <p className="truncate text-sm text-muted-foreground">{product.title}</p>
            <p className="font-semibold text-lg">{formatPrice(onTable)}</p>
            <p className="text-xs text-muted-foreground">
              Listed at {formatPrice(product.price)}
            </p>
            {sent && (
              <p className="text-sm text-muted-foreground">Sent on {format(sent, 'PPP')}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
