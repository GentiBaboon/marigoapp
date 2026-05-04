
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWishlist } from '@/context/WishlistContext';
import React from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import type { FirestoreProduct } from '@/lib/types';

interface ProductCardProps {
  product: Partial<FirestoreProduct> & { id: string; brand?: string; image?: string };
  className?: string;
}

export const ProductCard = React.memo(function ProductCard({ product, className }: ProductCardProps) {
  const { isFavorite, addToWishlist, removeFromWishlist } = useWishlist();
  const { formatPrice } = useCurrency();
  const favorite = isFavorite(product.id);

  // Handle new images structure or fallback to old 'image' field.
  // Only use URLs that are valid https:// links (Supabase or Firebase Storage).
  // Discard blob: URLs (dead after reload), data: URIs (too large for <Image>), and empty strings.
  const rawImage = product.images?.[0];
  const rawUrl = typeof rawImage === 'string' ? rawImage : rawImage?.url || product.image || '';
  const imageUrl = typeof rawUrl === 'string' && rawUrl.startsWith('http') ? rawUrl : '';

  const handleToggleFavorite = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (favorite) {
          removeFromWishlist(product.id);
      } else {
          addToWishlist(product.id);
      }
  }, [favorite, product.id, addToWishlist, removeFromWishlist]);

  const displayTitle = product.title || 'Untitled Product';
  const brandName = product.brandId || product.brand || 'Luxury Item';
  const isReserved = product.status === 'reserved' || product.status === 'sold';

  return (
    <div className={cn('group', className)}>
      <Link href={`/products/${product.id}`} className="block mb-2">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted rounded-lg">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayTitle}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className={cn('object-cover', isReserved && 'opacity-60')}
              unoptimized={false}
            />
          ) : (
            <div className="aspect-square w-full bg-muted flex items-center justify-center text-muted-foreground text-[10px]">
                NO PHOTO
            </div>
          )}
          {product.vintage && (
             <Badge variant="outline" className="absolute top-2 left-2 bg-background/80 font-normal text-[10px]">VINTAGE</Badge>
          )}
          {isReserved && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-foreground text-background text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow">
                Reserved
              </span>
            </div>
          )}
        </div>
      </Link>
      <div className="px-1">
        <div className="flex justify-between items-start">
          <div className="text-sm flex-1 min-w-0">
            <p className="font-bold uppercase text-[11px] tracking-wider truncate">{brandName}</p>
            <p className="text-muted-foreground text-xs truncate">{displayTitle}</p>
            {product.size && (
              <p className="text-muted-foreground text-[10px]">{product.size}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            aria-label="Add to wishlist"
            onClick={handleToggleFavorite}
          >
            <Heart className={cn("h-4 w-4", favorite && "fill-destructive text-destructive")} />
          </Button>
        </div>
        <div className="mt-1">
          {product.originalPrice && (
            <p className="text-[10px] text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </p>
          )}
          <p className="font-bold text-sm">
            {product.price ? formatPrice(product.price) : 'Contact for price'}
          </p>
        </div>
      </div>
    </div>
  );
});
