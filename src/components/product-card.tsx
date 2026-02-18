import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWishlist } from '@/context/WishlistContext';
import React from 'react';
import { useCurrency } from '@/context/CurrencyContext';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { isFavorite, addToWishlist, removeFromWishlist } = useWishlist();
  const { formatPrice } = useCurrency();
  const favorite = isFavorite(product.id);

  let imageUrl: string | undefined;
  let imageHint: string | undefined;

  const isUrl =
    product.image?.startsWith('http') || product.image?.startsWith('data:');

  if (isUrl) {
    imageUrl = product.image;
  } else if (product.image) {
    const productImage = PlaceHolderImages.find((p) => p.id === product.image);
    if (productImage) {
      imageUrl = productImage.imageUrl;
      imageHint = productImage.imageHint;
    }
  }
  
  const handleToggleFavorite = (e: React.MouseEvent) => {
      e.preventDefault(); // prevent navigation
      e.stopPropagation();
      if (favorite) {
          removeFromWishlist(product.id);
      } else {
          addToWishlist(product.id);
      }
  }

  const displayTitle = product.title;


  return (
    <div className={cn('group', className)}>
      <Link href={`/products/${product.id}`} className="block mb-2">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayTitle || ''}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
              data-ai-hint={imageHint}
            />
          ) : (
            <div className="aspect-square w-full bg-muted" />
          )}
          {product.vintage && (
             <Badge variant="outline" className="absolute top-2 left-2 bg-background/80 font-normal">VINTAGE</Badge>
          )}
        </div>
      </Link>
      <div className="px-1">
        <div className="flex justify-between items-start">
          <div className="text-sm">
            <p className="font-bold uppercase">{product.brand}</p>
            <p className="text-muted-foreground">{displayTitle}</p>
            {product.size && (
              <p className="text-muted-foreground">{product.size}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Add to wishlist"
            onClick={handleToggleFavorite}
          >
            <Heart className={cn("h-5 w-5", favorite && "fill-destructive text-destructive")} />
          </Button>
        </div>
        <div className="mt-2">
          {product.originalPrice && (
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </p>
          )}
          <p className="font-semibold">
            {formatPrice(product.price)}
          </p>
          {product.sellerLocation && (
            <p className="text-sm text-muted-foreground mt-1">
              {product.sellerLocation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
