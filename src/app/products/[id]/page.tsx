'use client'; 

import * as React from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Heart,
  Share2,
  Star,
  MessageSquare,
  Store,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductCard } from '@/components/product-card';
import {
  productSizes,
  productColors,
  trendingProducts,
  newArrivals,
} from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';

// Mock product data for a single product. In a real app, this would be fetched.
const product = {
  id: '1',
  brand: 'Chanel',
  title: 'Classic Medium Double Flap Bag',
  price: 8200,
  originalPrice: 9000,
  sellerId: 'seller-1',
  image: 'product-1',
  images: ['product-1', 'banner-3', 'product-7'],
  description:
    'The epitome of timeless elegance, the Chanel Classic Flap bag is a must-have for any luxury connoisseur. Crafted from exquisite quilted lambskin with polished hardware, this iconic piece transitions seamlessly from day to night.',
  condition: 'like_new' as const,
};

// Mock seller data
const seller = {
  name: 'Luxury Finds Boutique',
  rating: 4.9,
  reviews: 124,
  avatar: 'https://picsum.photos/seed/seller/100/100',
};

// Mock related products
const relatedProducts = [...trendingProducts, ...newArrivals].slice(0, 4);

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [selectedSize, setSelectedSize] = React.useState<string | null>(null);
  const [selectedColor, setSelectedColor] = React.useState<string | null>(
    productColors[0]?.name || null
  );
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = () => {
    addToCart(product, { selectedSize: selectedSize || undefined, selectedColor: selectedColor || undefined });
  };

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Carousel */}
        <div className="md:sticky md:top-24 self-start">
           <Carousel className="w-full">
            <CarouselContent>
              {product.images.map((imgId, index) => {
                const imageData = PlaceHolderImages.find((p) => p.id === imgId);
                return (
                  <CarouselItem key={index}>
                    <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
                      {imageData && (
                        <Image
                          src={imageData.imageUrl}
                          alt={`${product.title} image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 hidden md:flex" />
            <CarouselNext className="absolute right-4 hidden md:flex" />
          </Carousel>
        </div>

        {/* Product Details */}
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {product.brand}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Share2 className="h-5 w-5" />
                  <span className="sr-only">Share</span>
                </Button>
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" />
                  <span className="sr-only">Add to wishlist</span>
                </Button>
              </div>
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              {product.title}
            </h1>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-destructive">
                {currencyFormatter.format(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-muted-foreground line-through">
                  {currencyFormatter.format(product.originalPrice)}
                </span>
              )}
            </div>
            <Badge variant="outline" className="capitalize">
              Condition: {product.condition.replace('_', ' ')}
            </Badge>
          </div>

          <Separator />

          {/* Color Selector */}
          <div>
            <h3 className="text-sm font-medium mb-2">Color: <span className="font-normal text-muted-foreground">{selectedColor}</span></h3>
            <div className="flex flex-wrap gap-2">
              {productColors.map((color) => (
                <Button
                  key={color.name}
                  variant="outline"
                  size="icon"
                  className={cn('rounded-full h-8 w-8', {
                    'ring-2 ring-primary ring-offset-2':
                      selectedColor === color.name,
                  })}
                  onClick={() => setSelectedColor(color.name)}
                >
                  <div
                    className="h-6 w-6 rounded-full border"
                    style={{ backgroundColor: color.hex }}
                  ></div>
                  <span className="sr-only">{color.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div>
            <h3 className="text-sm font-medium mb-2">Size</h3>
             <RadioGroup
              value={selectedSize || ''}
              onValueChange={setSelectedSize}
              className="flex flex-wrap gap-2"
            >
              {productSizes.map((size) => (
                 <div key={size} className="flex items-center">
                   <RadioGroupItem value={size} id={`size-${size}`} className="sr-only" />
                   <Label
                    htmlFor={`size-${size}`}
                    className={cn(
                      "flex items-center justify-center rounded-md border text-sm font-medium p-2 h-9 w-12 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      selectedSize === size && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                   >
                     {size}
                   </Label>
                 </div>
              ))}
            </RadioGroup>
          </div>
          
          <Separator />
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full bg-foreground text-background hover:bg-foreground/90" onClick={handleAddToCart}>Add to Cart</Button>
            <Button size="lg" variant="outline" className="w-full">Make an Offer</Button>
          </div>
          
          <Separator />

          {/* Description */}
          <div>
            <h3 className="font-bold text-lg mb-2 font-headline">Description</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {product.description}
            </p>
          </div>
          
          <Separator />
          
          {/* Seller Card */}
          <div className="rounded-lg border bg-card text-card-foreground">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <Avatar>
                        <AvatarImage src={seller.avatar} alt={seller.name} />
                        <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5">
                        <p className="font-semibold">{seller.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Star className="w-4 h-4 fill-accent stroke-accent" />
                            <span>{seller.rating} ({seller.reviews} reviews)</span>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
             <div className="border-t p-4 flex justify-around">
                <Button variant="outline" className="flex-1 mr-2">
                    <Store className="mr-2 h-4 w-4"/> Visit Store
                </Button>
                 <Button variant="outline" className="flex-1 ml-2">
                    <MessageSquare className="mr-2 h-4 w-4"/> Contact Seller
                </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Products */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold font-headline mb-6">
          You Might Also Like
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {relatedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
