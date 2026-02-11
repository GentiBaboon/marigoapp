'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Eye,
} from 'lucide-react';

import type { FirestoreProduct } from '@/lib/types';
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

const statusStyles = {
  active: 'bg-green-100 text-green-800 border-green-200',
  sold: 'bg-primary/10 text-primary border-primary/20',
  pending_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function ListingItem({ product }: { product: FirestoreProduct }) {
  const imageUrl = product.images?.[0]?.url || PlaceHolderImages.find(p => p.id === 'product-1')?.imageUrl || '/placeholder.png';
  const imageAlt = product.title || 'Product image';

  const getStatusLabel = (status: FirestoreProduct['status']) => {
    switch (status) {
      case 'active': return 'Active';
      case 'sold': return 'Sold';
      case 'pending_review': return 'In Review';
      case 'removed': return 'Removed';
      case 'expired': return 'Expired';
      case 'draft': return 'Draft';
      default: return 'Inactive';
    }
  };

  const getStatusVariant = (status: FirestoreProduct['status']): keyof typeof statusStyles => {
    if (status === 'active' || status === 'sold' || status === 'pending_review') {
        return status;
    }
    return 'inactive';
  }

  const statusVariant = getStatusVariant(product.status);

  return (
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
                <p className="text-sm font-medium text-muted-foreground">{product.brandId}</p>
                <h3 className="font-semibold text-foreground leading-tight">{product.title}</h3>
            </div>
             <Badge className={cn(statusStyles[statusVariant])}>
                {getStatusLabel(product.status)}
            </Badge>
        </div>

        <div className="flex items-end justify-between">
            <div>
                 <p className="font-bold text-lg">{currencyFormatter.format(product.price)}</p>
                 <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{product.views} views</span>
                    <span>{product.wishlistCount} favorites</span>
                 </div>
            </div>
            
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={`/products/${product.id}`} className="flex items-center">
                        <Eye className="mr-2 h-4 w-4" /> View Listing
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                {product.status === 'active' && (
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
  );
}
