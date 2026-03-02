
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, ChevronRight, Package, Truck, CheckCircle2 } from 'lucide-react';
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
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

const SellerInfo = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'users', sellerId) : null,
        [firestore, sellerId]
    );
    const { data: seller, isLoading } = useDoc<FirestoreUser>(sellerRef);

    if (isLoading) return <Skeleton className="h-3 w-20 mt-1" />;
    return <span className="font-medium text-foreground">@{seller?.name?.toLowerCase().replace(/\s+/g, '') || 'seller'}</span>;
};

export function OrderItem({ order }: { order: FirestoreOrder }) {
  const { formatPrice } = useCurrency();
  const item = order.items[0];
  
  const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
      pending_payment: { label: 'Pending Payment', color: 'bg-orange-100 text-orange-700', icon: Package },
      processing: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Package },
      shipped: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck },
      delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      completed: { label: 'Completed', color: 'bg-gray-100 text-gray-700', icon: CheckCircle2 },
  };

  const status = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100', icon: Package };
  const StatusIcon = status.icon;

  return (
    <div className="py-6 group">
        <div className="flex justify-between items-start mb-4">
            <div className="space-y-1">
                <Badge variant="outline" className={cn("rounded-md border-none font-semibold", status.color)}>
                    <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                    {status.label.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                    Order #{order.orderNumber} • {format(new Date(order.createdAt.seconds * 1000), 'd MMM yyyy')}
                </p>
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/profile/orders/${order.id}`}>Track Order</Link></DropdownMenuItem>
                    <DropdownMenuItem>Contact Seller</DropdownMenuItem>
                    <DropdownMenuItem>Need Help?</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        <Link href={`/profile/orders/${order.id}`} className="flex gap-4">
            <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm">
                <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
                <h3 className="font-bold text-base uppercase tracking-tight truncate">{item.brand}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Sold by <SellerInfo sellerId={item.sellerId} />
                </p>
            </div>
            <div className="flex flex-col items-end justify-between py-0.5">
                <span className="font-bold text-base">{formatPrice(order.totalAmount)}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
    </div>
  );
}
