import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Product } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  let imageUrl: string | undefined;
  let imageHint: string | undefined;

  // Check if image is a full URL (from firestore) or an ID (from mock data)
  const isUrl = product.image?.startsWith('http') || product.image?.startsWith('data:');

  if (isUrl) {
    imageUrl = product.image;
  } else if (product.image) {
    const productImage = PlaceHolderImages.find((p) => p.id === product.image);
    if (productImage) {
      imageUrl = productImage.imageUrl;
      imageHint = productImage.imageHint;
    }
  }

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-lg border-border/60 shadow-sm hover:shadow-xl transition-shadow duration-300 group',
        className
      )}
    >
      <CardContent className="p-0">
        <div className="relative">
          <Link href={`/products/${product.id}`} className="block">
            <div className="relative aspect-square w-full overflow-hidden">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint={imageHint}
                />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
            </div>
          </Link>
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-muted-foreground hover:text-destructive"
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 md:p-4 space-y-2">
          <Link href={`/products/${product.id}`} className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground truncate">
              {product.brand}
            </p>
            <h3 className="font-medium text-foreground truncate">
              {product.title}
            </h3>
          </Link>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-lg font-bold text-destructive">
              {currencyFormatter.format(product.price)}
            </p>
            {product.originalPrice && (
              <p className="text-sm text-muted-foreground line-through">
                {currencyFormatter.format(product.originalPrice)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
