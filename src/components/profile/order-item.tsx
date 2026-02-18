'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

import type { FirestoreOrder, FirestoreUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/CurrencyContext';
import { useI18n } from '@/hooks/use-i18n';

// A new sub-component to fetch and display the seller's name
const SellerInfo = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    // Memoize the document reference
    const sellerRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'users', sellerId) : null,
        [firestore, sellerId]
    );
    const { data: seller, isLoading } = useDoc<FirestoreUser>(sellerRef);

    if (isLoading) {
        return <Skeleton className="h-4 w-24 mt-1" />;
    }

    if (!seller) {
        return <p className="text-sm text-muted-foreground">Sold by: an unknown seller</p>;
    }
    
    // The image shows "Genti", which seems to be the display name.
    return (
        <p className="text-sm text-muted-foreground">
            Sold by: <Link href={`/profile/${seller.id}`} onClick={(e) => e.stopPropagation()} className="underline text-foreground hover:text-primary">{seller.displayName}</Link>
        </p>
    );
};


type OrderItemProps = {
  order: FirestoreOrder;
};

export function OrderItem({ order }: OrderItemProps) {
  const { formatPrice } = useCurrency();
  const { l } = useI18n();

  const firstItem = order.items[0];
  const imageUrl = firstItem.image;
  const displayTitle = l(firstItem.title);
  const imageAlt = displayTitle;
  // Assuming a single seller for simplicity as per the current data model for items.
  const sellerId = firstItem.sellerId; 

  return (
    <div className="py-4 border-b">
        <div className="flex justify-between items-center mb-3">
            <div>
                <h2 className="font-semibold text-lg">Order #{order.orderNumber}</h2>
                <p className="text-sm text-muted-foreground">
                    Purchase date: {format(new Date(order.createdAt.seconds * 1000), 'd MMM yyyy')}
                </p>
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem>Track Order</DropdownMenuItem>
                    <DropdownMenuItem>Contact Seller</DropdownMenuItem>
                    <DropdownMenuItem>View Invoice</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        <Link href={`/profile/orders/${order.id}`} className="block mb-3 group">
            <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                        src={imageUrl}
                        alt={imageAlt}
                        fill
                        className="object-cover"
                        sizes="64px"
                    />
                </div>
                <div className="flex-1 space-y-0.5">
                    <h3 className="font-bold text-lg uppercase">{firstItem.brand}</h3>
                    <p className="text-sm text-muted-foreground">{displayTitle}</p>
                    {sellerId && <SellerInfo sellerId={sellerId} />}
                </div>
                <ChevronRight className="h-6 w-6 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
        </Link>
        
        <div className="font-semibold text-lg">
            Order value: {formatPrice(order.totalAmount)}
        </div>
    </div>
  );
}
