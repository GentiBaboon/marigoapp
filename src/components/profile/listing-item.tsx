'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Eye,
} from 'lucide-react';
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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useCurrency } from '@/context/CurrencyContext';

const statusStyles = {
  active: 'bg-green-100 text-green-800 border-green-200',
  sold: 'bg-primary/10 text-primary border-primary/20',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  pending_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function ListingItem({ product, order }: { product?: FirestoreProduct, order?: FirestoreOrder }) {
  const isSale = !!order;
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();

  const itemData = isSale ? order.items[0] : product!;
  const imageUrl = isSale ? order.items[0].image : (product?.images?.[0] || PlaceHolderImages.find(p => p.id === 'product-1')?.imageUrl || '/placeholder.png');
  const displayTitle = itemData.title ?? 'Untitled';
  const imageAlt = displayTitle || 'Product image';
  
  const link = isSale ? `/profile/listings/sales/${order.id}` : `/products/${product!.id}`;
  const status = isSale ? order.status : product!.status;
  
  const offersQuery = useMemoFirebase(() => {
    if (isSale || !firestore || !product) return null;
    return query(collection(firestore, 'products', product.id, 'offers'), where('status', '==', 'pending'));
  }, [firestore, product, isSale]);

  const { data: offers } = useCollection<FirestoreOffer>(offersQuery);
  const activeOfferCount = offers?.length || 0;

  const getStatusLabel = (s: string) => {
      if (s === 'processing') return 'To ship';
      if (s === 'pending_review') return 'In Review';
      return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getStatusVariant = (s: string): keyof typeof statusStyles => {
      return (statusStyles[s as keyof typeof statusStyles] ? s : 'inactive') as keyof typeof statusStyles;
  }

  const statusVariant = getStatusVariant(status);
  
  return (
    <>
      <div className="flex items-center gap-4 rounded-lg border p-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between">
              <div>
                  <p className="text-sm font-medium text-muted-foreground">{product?.category || 'Sale'}</p>
                  <h3 className="font-semibold text-foreground leading-tight">{displayTitle}</h3>
              </div>
              <Badge className={cn(statusStyles[statusVariant])}>
                  {getStatusLabel(status)}
              </Badge>
          </div>

          <div className="flex items-end justify-between">
              <div>
                   <p className="font-bold text-lg">{formatPrice(itemData.price)}</p>
                   {!isSale && activeOfferCount > 0 && (
                       <p className="text-sm font-semibold text-primary mt-1">{activeOfferCount} active offer(s)</p>
                   )}
              </div>
              
              <div className="flex items-center">
                  <Button variant="outline" size="sm" asChild>
                      <Link href={link}>
                          {isSale ? 'Manage Sale' : 'View'}
                      </Link>
                  </Button>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                          <Link href={link} className="flex items-center">
                              <Eye className="mr-2 h-4 w-4" /> {isSale ? 'View Sale Details' : 'View Listing'}
                          </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {!isSale && status === 'active' && (
                          <DropdownMenuItem>
                              <CheckCircle className="mr-2 h-4 w-4" /> Mark as sold
                          </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
              </div>
          </div>
        </div>
      </div>
    </>
  );
}
