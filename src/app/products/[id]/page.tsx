'use client'; 

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  Heart,
  MessageSquare,
  Info,
  MapPin,
  Check,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductCard } from '@/components/product-card';
import { trendingProducts, newArrivals } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { MakeOfferSheet } from '@/components/product/make-offer-sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Mock product data to match the new design
const product = {
  id: 'polo-1',
  brand: 'Lacoste',
  title: 'Polo shirt',
  price: 41,
  sellerId: 'seller-constance',
  images: ['product-polo', 'product-polo-2', 'product-polo-3'],
  description: 'A classic Lacoste polo shirt in black cotton. A versatile wardrobe staple, perfect for any casual occasion. In very good condition with minimal signs of wear.',
  condition: 'good' as const,
  size: 'Size 7',
  color: 'Black',
  material: '100% cotton',
  sellerLocation: 'France'
};

// Mock seller data
const seller = {
  id: 'seller-constance',
  name: 'Constance',
  handle: '@clarenceblade',
  avatar: 'https://picsum.photos/seed/clarenceblade/100/100',
  location: 'France',
  isTrusted: true,
  shippingTime: 1,
  stats: {
      sold: 5,
      shipped: 5,
      cancelled: 0,
  }
};

// Mock related products
const relatedProducts = [...trendingProducts, ...newArrivals].slice(0, 4);

const PayPalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="h-8 w-auto flex-shrink-0">
        <path fill="#003087" d="M20.344 6.258c-.297-1.332-1.309-2.22-2.613-2.22H9.27c-.52 0-1.041.34-1.218.846l-3.08 9.539c-.115.356.035.753.39.868l2.969.957c.355.114.753-.035.868-.39l.235-.729a.63.63 0 0 1 .602-.45h.063l4.05-1.236c.356-.115.506-.513.39-.868l-.99-3.06a.63.63 0 0 1 .374-.75l.11-.035c.42-.14.72-.51.68-.96l-.23-1.44c-.03-.2.07-.4.25-.52z"/>
        <path fill="#009cde" d="M21.11 8.358c-.28-1.33-1.25-2.2-2.48-2.2H8.38c-.5 0-1 .32-1.16.8l-1.92 5.95c-.11.34.03.72.37.83l2.84.9c.34.11.72-.04.83-.38l.38-1.16a.6.6 0 0 1 .57-.42h.06l4.2-1.28c.34-.11.48-.5.37-.83l-.94-2.9a.6.6 0 0 1 .35-.7l.11-.04c.4-.13.68-.48.65-.9l-.22-1.38c-.03-.18.06-.38.24-.5z"/>
        <path fill="#012169" d="M12.445 13.118l-3.328 1.018a.63.63 0 0 0-.45.602l.236.729c.115.355.494.558.868.45l2.969-.957a.63.63 0 0 0 .45-.602l-.745-2.24z"/>
    </svg>
);

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [isOfferSheetOpen, setIsOfferSheetOpen] = React.useState(false);

  React.useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);
    api.on('select', () => setCurrent(api.selectedScrollSnap() + 1));
  }, [api]);

  const handleAddToCart = () => {
    addToCart({
      ...product,
      image: product.images[0]
    });
  };

  const currencyFormatter = (value: number) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  const conditionLabel = product.condition === 'good' ? 'Very good condition' : product.condition.replace('_', ' ');

  return (
    <div className="container mx-auto max-w-4xl px-0 md:px-4 py-6 md:py-10">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Carousel */}
        <div className="flex flex-col items-center">
           <Carousel setApi={setApi} className="w-full">
            <CarouselContent>
              {product.images.map((imgId, index) => {
                const imageData = PlaceHolderImages.find((p) => p.id === imgId);
                return (
                  <CarouselItem key={index}>
                    <div className="aspect-[3/4] relative bg-muted rounded-lg overflow-hidden">
                      {imageData && (
                        <Image
                          src={imageData.imageUrl}
                          alt={`${product.title} image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority={index === 0}
                        />
                      )}
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
          <div className="flex items-center space-x-2 mt-4">
            {Array.from({ length: count }).map((_, index) => (
              <div
                key={index}
                className={cn('h-2 w-2 rounded-full transition-colors', 
                  index + 1 === current ? 'bg-foreground' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>

        {/* Product Details */}
        <div className="flex flex-col gap-6 px-4 md:px-0">
          <div className="space-y-1">
            <h1 className="text-4xl font-headline text-foreground">{product.brand}</h1>
            <p className="text-lg text-muted-foreground">{product.title}</p>
          </div>

          <div className="flex items-start justify-between">
            <div className="space-y-1 text-sm">
                <p className="text-2xl font-bold flex items-center">{currencyFormatter(product.price)} <Info className="h-4 w-4 ml-2 text-muted-foreground"/></p>
                <p>{product.size} <Link href="#" className="underline text-muted-foreground">Size guide</Link></p>
                <p>{conditionLabel} <Link href="#" className="underline text-muted-foreground">More info</Link></p>
            </div>
             <Avatar className="h-12 w-12">
                <AvatarImage src={seller.avatar} alt={seller.name} />
                <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-gray-100 p-3">
              <PayPalIcon />
              <p className="text-sm text-gray-800">
                  Pay in 3 interest-free payments of €13,67. <Link href="#" className="underline font-semibold">Learn more</Link>
              </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full bg-foreground text-background hover:bg-foreground/90 h-12 text-base" onClick={handleAddToCart}>Add to bag</Button>
            <Button size="lg" variant="outline" className="w-full h-12 text-base" onClick={() => setIsOfferSheetOpen(true)}>Make an offer</Button>
             <Button size="lg" variant="outline" className="w-full h-12 text-base">
                <MessageSquare className="mr-2 h-5 w-5"/> Chat
            </Button>
          </div>
        </div>
      </div>
      
      <Separator className="my-8" />
      
      <div className="px-4 md:px-0 space-y-8">
          <div className="text-sm space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <p>{product.sellerLocation}, from the seller {seller.name} <Link href="#" className="underline text-muted-foreground">More info</Link></p>
              </div>
               <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <p>Optional Authenticity and Quality control <Link href="#" className="underline text-muted-foreground">More info</Link></p>
              </div>
          </div>
          
          <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">DETAILS</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {product.description}
              </p>
              <Button variant="outline" className="w-full">See more details</Button>
              <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground">
                <MessageSquare className="mr-2 h-4 w-4" />
                A question ? Leave a comment for the seller
              </Button>
          </div>
          
          <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">MORE INFORMATION</h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Expert authentication</AccordionTrigger>
                  <AccordionContent>
                    Yes. Our team of experts will authenticate this item for you.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Payment</AccordionTrigger>
                  <AccordionContent>
                    We accept all major credit cards and PayPal.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Shipping</AccordionTrigger>
                  <AccordionContent>
                    Shipping costs are calculated at checkout.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>Returns</AccordionTrigger>
                  <AccordionContent>
                    You can return this item within 14 days of receipt.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>Help</AccordionTrigger>
                  <AccordionContent>
                    Contact our customer support for any questions.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Seller</h3>
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                         <Avatar className="h-14 w-14">
                            <AvatarImage src={seller.avatar} alt={seller.name} />
                            <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-bold">{seller.name}</p>
                            <p className="text-sm text-muted-foreground">{seller.handle}</p>
                        </div>
                        <Button variant="outline">Follow</Button>
                    </div>

                    <div className="space-y-3 text-sm mb-4">
                        {seller.isTrusted && (
                             <div className="flex items-center gap-2 font-medium">
                                <ShieldCheck className="h-5 w-5 text-green-600" />
                                <span>Trusted Seller</span>
                            </div>
                        )}
                        <p>Usually ships in <span className="font-bold">{seller.shippingTime} days</span></p>
                    </div>

                    <div className="grid grid-cols-3 text-center border-t pt-3">
                        <div>
                            <p className="font-bold">{seller.stats.sold}</p>
                            <p className="text-xs text-muted-foreground">items sold</p>
                        </div>
                         <div>
                            <p className="font-bold">{seller.stats.shipped}</p>
                            <p className="text-xs text-muted-foreground">shipped</p>
                        </div>
                         <div>
                            <p className="font-bold">{seller.stats.cancelled}</p>
                            <p className="text-xs text-muted-foreground">cancelled</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <p className="text-xs text-muted-foreground mt-4">
                This item is offered by an individual seller. Its price has been suggested by its seller.
            </p>
          </div>
      </div>

      {/* Suggested Products */}
      <div className="mt-16 px-4 md:px-0">
        <h2 className="text-2xl font-bold font-headline mb-6">
          You Might Also Like
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {relatedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      <MakeOfferSheet
        isOpen={isOfferSheetOpen}
        onOpenChange={setIsOfferSheetOpen}
        product={product}
      />
    </div>
  );
}
