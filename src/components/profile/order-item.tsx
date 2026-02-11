'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Truck } from 'lucide-react';
import { format } from 'date-fns';

import type { FirestoreOrder, FirestoreProduct } from '@/lib/types';
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

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const statusStyles: { [key: string]: string } = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
};

type OrderItemProps = {
  order: FirestoreOrder;
  product: FirestoreProduct;
  userRole: 'buyer' | 'seller';
};

export function OrderItem({ order, product, userRole }: OrderItemProps) {
  const imageUrl = product.images?.[0]?.url || PlaceHolderImages.find(p => p.id === 'product-1')?.imageUrl || '/placeholder.png';
  const imageAlt = product.title || 'Product image';

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  const statusVariant = statusStyles[order.status] || statusStyles.default;

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
            <span className="font-semibold text-foreground">Order #{order.orderNumber}</span>
            <span className="mx-2">|</span>
            <span>{format(order.createdAt.toDate(), 'PPP')}</span>
        </div>
        <Badge className={cn(statusVariant)}>{getStatusLabel(order.status)}</Badge>
      </div>
      <div className="flex items-center gap-4">
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
            <p className="text-sm font-medium text-muted-foreground">{product.brandId}</p>
            <h3 className="font-semibold text-foreground leading-tight">{product.title}</h3>
            <p className="font-bold text-lg">{currencyFormatter.format(order.totalAmount)}</p>
        </div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/profile/orders/${order.id}`}>View Order Details</Link>
              </DropdownMenuItem>
              {order.status === 'shipped' && (
                <DropdownMenuItem>
                    <Truck className="mr-2 h-4 w-4" />
                    Track Shipment
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
