'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreOffer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, Info } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';

const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

function OfferPageSkeleton() {
    return (
        <div className="container mx-auto max-w-lg px-4 py-8">
            <div className="flex items-center gap-4 mb-6">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-6 w-32" />
            </div>

            <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                    </div>
                </div>
                <Skeleton className="h-10 w-full" />
            </div>
            
            <div className="mt-8 flex flex-col items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
        </div>
    );
}

export default function OfferPage({ params }: { params: { id: string; offerId: string } }) {
    const { id: productId, offerId } = params;
    const firestore = useFirestore();

    const productRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);
    const { data: product, isLoading: isProductLoading } = useDoc<FirestoreProduct>(productRef);

    const offerRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'products', productId, 'offers', offerId);
    }, [firestore, productId, offerId]);
    const { data: offer, isLoading: isOfferLoading } = useDoc<FirestoreOffer>(offerRef);

    const isLoading = isProductLoading || isOfferLoading;
    
    if (isLoading) {
        return <OfferPageSkeleton />;
    }
    
    if (!product || !offer) {
        return (
             <div className="container mx-auto max-w-lg px-4 py-8 text-center">
                <h1 className="text-xl font-bold">Offer not found</h1>
                <p className="text-muted-foreground">The requested product or offer could not be found.</p>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/home">Go to Homepage</Link>
                </Button>
            </div>
        );
    }
    
    // Find image, fallback if needed
    const productImageData = product.images?.[0]?.url 
      ? PlaceHolderImages.find((p) => p.id === product.images[0].url)
      : null;
    const imageUrl = productImageData?.imageUrl || 'https://placehold.co/64x64/E2E8F0/A0AEC0?text=MARIGO';

    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
            <Button asChild variant="ghost" size="icon">
                <Link href={`/products/${productId}`}>
                    <ArrowLeft />
                    <span className="sr-only">Back to product</span>
                </Link>
            </Button>
            <h1 className="text-xl font-bold">Your offers</h1>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-md bg-muted overflow-hidden">
                    <Image src={imageUrl} alt={product.title} fill sizes="64px" className="object-cover" />
                </div>
                <div>
                    <p className="font-bold">{product.brandId}</p>
                    <p>{product.title}</p>
                    <p className="text-muted-foreground flex items-center">{currencyFormatter(product.price)} <Info className="h-4 w-4 ml-1" /></p>
                </div>
            </div>
            <Button variant="outline" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Seller
            </Button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
            {offer.createdAt && (
                <p className="text-sm text-muted-foreground">
                    {format(new Date(offer.createdAt.seconds * 1000), 'dd/MM/yy, HH:mm')}
                </p>
            )}
            <div className="bg-primary/10 text-primary-foreground p-3 rounded-lg border border-primary/20">
                <a href="#" className="underline font-semibold text-primary">Offer sent: {currencyFormatter(offer.amount)}</a>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
                The seller has 2 days to respond.
            </p>
        </div>
      </div>
    );
}
