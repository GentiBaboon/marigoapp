
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Edit, Trash2, CheckCircle, Eye, ArrowRight, Package } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct, FirestoreOffer, FirestoreOrder } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  sold: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

export function ListingItem({ product, order }: { product?: FirestoreProduct, order?: FirestoreOrder }) {
  const isSale = !!order;
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();

  const itemData = isSale ? order.items[0] : product!;
  const imageUrl = isSale ? order.items[0].image : (product?.images?.[0]?.url || '/placeholder.png');
  const displayTitle = itemData.title ?? 'Untitled';
  const displayBrand = isSale ? (order.items[0].brand || 'Luxury Item') : (product?.brandId || 'Luxury Item');

  const link = isSale ? `/profile/listings/sales/${order.id}` : `/products/${product!.id}`;
  const status = isSale ? order.status : product!.status;
  
  const offersQuery = useMemoFirebase(() => {
    if (isSale || !firestore || !product) return null;
    return query(collection(firestore, 'products', product.id, 'offers'), where('status', '==', 'pending'));
  }, [firestore, product, isSale]);

  const { data: offers } = useCollection<FirestoreOffer>(offersQuery);
  const activeOfferCount = offers?.length || 0;

  const getStatusLabel = (s: string) => {
      if (s === 'processing') return 'Action Needed';
      if (s === 'pending_review') return 'In Review';
      return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border p-4 bg-background hover:shadow-sm transition-shadow">
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image
            src={imageUrl}
            alt={displayTitle}
            fill
            className="object-cover"
            sizes="80px"
          />
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                  <h3 className="font-bold text-sm uppercase tracking-tight truncate">{displayBrand}</h3>
                  <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
              </div>
              <Badge className={cn("border-none shrink-0", statusStyles[status] || 'bg-gray-100 text-gray-800')}>
                  {getStatusLabel(status)}
              </Badge>
          </div>

          <div className="flex items-center justify-between pt-1">
              <div>
                   <p className="font-bold text-base">{formatPrice(itemData.price)}</p>
                   {!isSale && activeOfferCount > 0 && (
                       <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{activeOfferCount} offer(s) pending</p>
                   )}
              </div>
              
              <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" asChild className="h-8 rounded-full">
                      <Link href={link}>
                          {isSale ? (
                              <>Fulfill <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
                          ) : 'View'}
                      </Link>
                  </Button>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                              <Link href={link}>{isSale ? 'View Details' : 'Preview Listing'}</Link>
                          </DropdownMenuItem>
                          {!isSale && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/products/${product!.id}/edit`}>Edit Listing</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </>
                          )}
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>
          </div>
        </div>
    </div>
  );
}
