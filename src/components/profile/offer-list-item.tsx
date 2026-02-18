'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

import type { OfferWithProduct } from '@/app/profile/offers/page';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';

const statusStyles: { [key: string]: string } = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  countered: 'bg-blue-100 text-blue-800 border-blue-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-gray-100 text-gray-800 border-gray-200',
  expired: 'bg-gray-100 text-gray-800 border-gray-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function OfferListItem({ offer }: { offer: OfferWithProduct }) {
    const { product } = offer;
    const { formatPrice } = useCurrency();

    const imageUrl = product.images?.[0] || 'https://placehold.co/96x96/E2E8F0/A0AEC0?text=MARIGO';
    const displayTitle = product.title?.en;
    const imageAlt = displayTitle;

    const getStatusLabel = (status: string) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const statusVariant = statusStyles[offer.status] || statusStyles.default;

    return (
        <Link href={`/products/${product.id}/offers/${offer.id}`} className="block">
            <div className="flex flex-col gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        <span className="font-semibold text-foreground">Offer for {displayTitle}</span>
                    </div>
                    <Badge className={cn(statusVariant)}>{getStatusLabel(offer.status)}</Badge>
                </div>
                <div className="flex items-start gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image src={imageUrl} alt={imageAlt} fill className="object-cover" sizes="96px" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="font-semibold text-lg">{formatPrice(offer.offerAmount)}</p>
                        {offer.status === 'countered' && offer.counterOfferAmount && (
                            <p className="text-sm font-semibold">Seller countered: <span className="text-primary">{formatPrice(offer.counterOfferAmount)}</span></p>
                        )}
                        <p className="text-sm text-muted-foreground">
                           Sent on {format(new Date(offer.createdAt.seconds * 1000), 'PPP')}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
