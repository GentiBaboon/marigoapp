
'use client'; 

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductCard } from '@/components/product-card';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { MakeOfferSheet } from '@/components/product/make-offer-sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { useWishlist } from '@/context/WishlistContext';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, doc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/CurrencyContext';
import { AuthenticityBadge } from '@/components/product/AuthenticityBadge';
import { ProductJsonLd } from '@/components/product/ProductJsonLd';

function ProductPageSkeleton() {
    return (
        <div className="container mx-auto max-w-4xl px-0 md:px-4 py-6 md:py-10">
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                <div className="flex flex-col gap-6 px-4 md:px-0">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </>
);

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { formatPrice } = useCurrency();

    const productRef = useMemoFirebase(() => {
        if (!firestore || !productId) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);
    const { data: product, isLoading: isProductLoading } = useDoc<FirestoreProduct>(productRef);

    const sellerRef = useMemoFirebase(() => {
        if (!firestore || !product?.sellerId) return null;
        return doc(firestore, 'users', product.sellerId);
    }, [firestore, product?.sellerId]);
    const { data: seller } = useDoc<FirestoreUser>(sellerRef);
    
    const { addToCart } = useCart();
    const { toast } = useToast();
  
    const [api, setApi] = React.useState<CarouselApi>();
    const [current, setCurrent] = React.useState(0);
    const [count, setCount] = React.useState(0);
    const [isOfferSheetOpen, setIsOfferSheetOpen] = React.useState(false);
    const [isChatLoading, setIsChatLoading] = React.useState(false);
    const { isFavorite, addToWishlist, removeFromWishlist } = useWishlist();

    const isSeller = user?.uid === product?.sellerId;
    const isSoldOrReserved = product?.status === 'sold' || product?.status === 'reserved';

    React.useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap() + 1);
        api.on('select', () => setCurrent(api.selectedScrollSnap() + 1));
    }, [api]);

    if (isProductLoading || isUserLoading) return <ProductPageSkeleton />;
    if (!product) return (
        <div className="container mx-auto max-w-4xl px-4 py-8 text-center">
            <h1 className="text-xl font-bold">Product not found</h1>
            <Button asChild variant="link" className="mt-4"><Link href="/home">Go to Homepage</Link></Button>
        </div>
    );

    const handleAddToCart = () => {
        if (!user) { router.push('/auth'); return; }
        addToCart(product);
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        isFavorite(product.id) ? removeFromWishlist(product.id) : addToWishlist(product.id);
    }

    return (
      <div className="container mx-auto max-w-4xl px-0 md:px-4 py-6 md:py-10 pb-32 md:pb-10">
        <ProductJsonLd product={product} seller={seller} />
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="flex flex-col items-center">
             <Carousel setApi={setApi} className="w-full relative">
              <CarouselContent>
                {product.images.map((img, index) => {
                    const imgUrl = typeof img === 'string' ? img : img?.url || '';
                    const isValidUrl = imgUrl.startsWith('http');
                    return (
                    <CarouselItem key={index}>
                      <div className="aspect-[3/4] relative bg-muted rounded-lg overflow-hidden">
                        {isValidUrl ? (
                        <Image
                          src={imgUrl}
                          alt={`${product.title} image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority={index === 0}
                        />
                        ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Image unavailable</div>
                        )}
                      </div>
                    </CarouselItem>
                    );
                  })}
              </CarouselContent>
               {count > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs font-semibold rounded-full px-3 py-1.5">
                    {current} / {count}
                </div>
              )}
            </Carousel>
          </div>
  
          <div className="flex flex-col gap-6 px-4 md:px-0">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-4xl font-headline text-foreground">{product.brandId}</h1>
                    <p className="text-lg text-muted-foreground">{product.title}</p>
                    <div className="pt-2"><AuthenticityBadge authenticityCheck={product.authenticityCheck} /></div>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={handleToggleFavorite}>
                    <Heart className={cn("h-6 w-6", isFavorite(product.id) && "fill-destructive text-destructive")} />
                </Button>
            </div>
            
            <div className="space-y-1 text-sm">
                <p className="text-2xl font-bold">{formatPrice(product.price)}</p>
                {product.size && (<p>Size: {product.size}</p>)}
                {product.condition && (<p>Condition: {product.condition.replace('_', ' ')}</p>)}
            </div>

            <div className="flex flex-col gap-3">
                {isSeller ? (
                    <Button size="lg" className="w-full">Manage Listing</Button>
                ) : (
                    <>
                        <Button size="lg" className="w-full bg-foreground text-background" onClick={handleAddToCart} disabled={isSoldOrReserved}>Add to bag</Button>
                        <Button size="lg" variant="outline" className="w-full" onClick={() => setIsOfferSheetOpen(true)} disabled={isSoldOrReserved}>Make an offer</Button>
                    </>
                )}
            </div>
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <div className="px-4 md:px-0">
            <Accordion type="single" collapsible className="w-full" defaultValue="description">
              <AccordionItem value="description">
                <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description & Details</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2">
                    {product.color && <DetailRow label="Color" value={product.color} />}
                    {product.material && <DetailRow label="Material" value={product.material} />}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </div>
  
        <MakeOfferSheet
          isOpen={isOfferSheetOpen}
          onOpenChange={setIsOfferSheetOpen}
          product={{ id: product.id, price: product.price, brand: product.brandId, sellerId: product.sellerId }}
        />
      </div>
    );
}
