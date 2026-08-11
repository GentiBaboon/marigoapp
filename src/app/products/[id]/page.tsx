
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
  AlertCircle,
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
import { collection, query, where, limit, doc, getDocs, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/CurrencyContext';
import { AuthenticityBadge } from '@/components/product/AuthenticityBadge';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { SellerBadge } from '@/components/SellerBadge';
import { SizeGuide } from '@/components/product/SizeGuide';

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
    const [failedImages, setFailedImages] = React.useState<Set<number>>(new Set());
    const [isChatLoading, setIsChatLoading] = React.useState(false);
    const [selectedSize, setSelectedSize] = React.useState<string | null>(null);
    const { isFavorite, addToWishlist, removeFromWishlist } = useWishlist();

    // Multi-variant listings carry a per-size inventory table. For those we
    // require the buyer to pick a size before adding to cart, and we show
    // "X left" indicators on each size pill.
    const hasVariants = Array.isArray(product?.variants) && product!.variants!.length > 0;
    const selectedVariant = hasVariants
      ? product!.variants!.find(v => v.size === selectedSize)
      : undefined;
    const variantOutOfStock = hasVariants && !!selectedVariant && selectedVariant.quantity <= 0;

    const isSeller = user?.uid === product?.sellerId;
    const isSoldOrReserved = product?.status === 'sold' || product?.status === 'reserved';

    React.useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap() + 1);
        api.on('select', () => setCurrent(api.selectedScrollSnap() + 1));
    }, [api]);

    // Bump the product's view count once per browser session. Sellers don't
    // inflate their own views, and a session-storage key per product means
    // refreshes within the same tab session don't double-count.
    React.useEffect(() => {
        if (!firestore || !product?.id || !user) return;
        if (user.uid === product.sellerId) return;
        const key = `marigo_viewed_${product.id}`;
        if (typeof window === 'undefined' || sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        updateDoc(doc(firestore, 'products', product.id), { views: increment(1) })
          .catch((err) => console.warn('views bump failed:', err));
    }, [firestore, product?.id, product?.sellerId, user]);

    if (isProductLoading || isUserLoading) return <ProductPageSkeleton />;
    if (!product) return (
        <div className="container mx-auto max-w-4xl px-4 py-8 text-center">
            <h1 className="text-xl font-bold">Product not found</h1>
            <Button asChild variant="link" className="mt-4"><Link href="/home">Go to Homepage</Link></Button>
        </div>
    );

    const handleAddToCart = () => {
        if (!user) { router.push('/auth'); return; }
        if (hasVariants) {
            if (!selectedSize) {
                toast({ variant: 'destructive', title: 'Select a size first.' });
                return;
            }
            if (variantOutOfStock) {
                toast({ variant: 'destructive', title: 'That size is out of stock.' });
                return;
            }
        }
        addToCart(product, { selectedSize: selectedSize ?? undefined });
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        isFavorite(product.id) ? removeFromWishlist(product.id) : addToWishlist(product.id);
    }

    const handleContactSeller = async () => {
        if (!user) { router.push('/auth'); return; }
        setIsChatLoading(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/start-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({
                    productId: product.id,
                    sellerId: product.sellerId,
                    productTitle: product.title,
                    productImage: product.images?.[0] || '',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(`/messages/${data.conversationId}`);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not start conversation.' });
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
      <div className="container mx-auto max-w-4xl px-0 md:px-4 py-6 md:py-10 pb-32 md:pb-10">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="flex flex-col items-center">
             <Carousel setApi={setApi} className="w-full relative">
              <CarouselContent>
                {(product.images ?? []).map((img, index) => {
                    const imgUrl = typeof img === 'string' ? img : img?.url || '';
                    const isValidUrl = imgUrl.startsWith('http') || imgUrl.startsWith('data:');
                    return (
                    <CarouselItem key={index}>
                      <div className="aspect-[3/4] relative bg-muted rounded-lg overflow-hidden">
                        {isValidUrl && !failedImages.has(index) ? (
                        <Image
                          src={imgUrl}
                          alt={`${product.title} image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority={index === 0}
                          unoptimized={imgUrl.startsWith('data:')}
                          onError={() => setFailedImages(prev => new Set(prev).add(index))}
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
                {(() => {
                  const hasDiscount = typeof product.originalPrice === 'number' && product.originalPrice > product.price;
                  const pct = hasDiscount
                    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
                    : 0;
                  return (
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <p className="text-2xl font-bold">{formatPrice(product.price)}</p>
                      {hasDiscount && (
                        <>
                          <p className="text-base text-muted-foreground line-through">
                            {formatPrice(product.originalPrice!)}
                          </p>
                          <span className="text-xs font-bold text-green-700 bg-green-50 rounded px-2 py-0.5">
                            −{pct}%
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
                {hasVariants ? (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Select size{product.sizeSystem ? ` (${product.sizeSystem})` : ''}
                      </p>
                      <SizeGuide categoryType={product.categoryId} sizeSystem={product.sizeSystem} currentSize={selectedSize ?? undefined} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.variants!.map((v) => {
                        const outOfStock = (v.quantity ?? 0) <= 0;
                        const isSelected = selectedSize === v.size;
                        return (
                          <button
                            key={v.size}
                            type="button"
                            disabled={outOfStock}
                            onClick={() => setSelectedSize(v.size)}
                            className={cn(
                              'min-w-[3.5rem] px-3 py-2 rounded-md border text-sm font-semibold transition-all',
                              isSelected && !outOfStock && 'border-foreground bg-foreground text-background',
                              !isSelected && !outOfStock && 'border-input hover:border-foreground',
                              outOfStock && 'border-input text-muted-foreground line-through cursor-not-allowed opacity-60',
                            )}
                          >
                            {v.size}
                            <span className="block text-[10px] font-normal opacity-75">
                              {outOfStock ? 'Sold out' : `${v.quantity} left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  product.size && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <p>Size: {product.size}{product.sizeSystem ? ` (${product.sizeSystem})` : ''}</p>
                      <SizeGuide categoryType={product.categoryId} sizeSystem={product.sizeSystem} currentSize={product.size} />
                    </div>
                  )
                )}
                {product.condition && (<p>Condition: {product.condition.replace('_', ' ')}</p>)}
                {(product.views || product.wishlistCount) ? (
                  <p className="text-xs text-muted-foreground pt-1">
                    {(product.views ?? 0).toLocaleString()} {product.views === 1 ? 'view' : 'views'}
                    {' · '}
                    {(product.wishlistCount ?? 0).toLocaleString()} {product.wishlistCount === 1 ? 'favorite' : 'favorites'}
                  </p>
                ) : null}
            </div>

            <div className="flex flex-col gap-3">
                {isSeller ? (
                    <Button size="lg" className="w-full" asChild>
                        <Link href={`/products/${productId}/edit`}>Manage Listing</Link>
                    </Button>
                ) : (
                    <>
                        <Button
                            size="lg"
                            className="w-full bg-foreground text-background"
                            onClick={handleAddToCart}
                            disabled={isSoldOrReserved || (hasVariants && (!selectedSize || variantOutOfStock))}
                        >
                            {isSoldOrReserved
                              ? 'Reserved'
                              : hasVariants && !selectedSize
                                ? 'Select a size'
                                : variantOutOfStock
                                  ? 'Out of stock'
                                  : 'Add to bag'}
                        </Button>
                        {!isSoldOrReserved && (
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full"
                                onClick={() => setIsOfferSheetOpen(true)}
                            >
                                Make an offer
                            </Button>
                        )}
                        <Button size="lg" variant="ghost" className="w-full border" onClick={handleContactSeller} disabled={isChatLoading}>
                            {isChatLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                            Contact Seller
                        </Button>
                    </>
                )}
            </div>

            {seller && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="h-10 w-10">
                  {seller.profileImage && <AvatarImage src={seller.profileImage} alt={seller.name || 'Seller'} />}
                  <AvatarFallback>{(seller.name?.[0] || 'S').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{seller.name || 'Marigo Seller'}</p>
                  <div className="mt-1">
                    <SellerBadge user={seller} />
                  </div>
                </div>
              </div>
            )}
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
                    {product.gender && <DetailRow label="Gender" value={product.gender.charAt(0).toUpperCase() + product.gender.slice(1)} />}
                    {product.pattern && <DetailRow label="Pattern" value={product.pattern} />}
                    {product.size && <DetailRow label="Size" value={product.size} />}
                    {product.categoryId && <DetailRow label="Category" value={product.categoryId} />}
                    {product.subcategoryId && <DetailRow label="Subcategory" value={product.subcategoryId} />}
                    {product.listingType && <DetailRow label="Listing Type" value={product.listingType === 'fixed_price' ? 'Fixed Price' : 'Auction'} />}
                    {product.vintage && <DetailRow label="Vintage" value="Yes (15+ years)" />}
                    {product.originalPrice && <DetailRow label="Original Price" value={formatPrice(product.originalPrice)} />}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </div>
  
        <RelatedProducts product={product} />

        <MakeOfferSheet
          isOpen={isOfferSheetOpen}
          onOpenChange={setIsOfferSheetOpen}
          product={{ id: product.id, price: product.price, brand: product.brandId, sellerId: product.sellerId }}
        />
      </div>
    );
}
