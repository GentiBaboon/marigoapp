'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreOffer, FirestoreUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

const currencyFormatter = (value: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
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
            </div>
            <div className="mt-8 flex flex-col items-center gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}

function OfferTimeline({ offer, product, buyer, seller }: { offer: FirestoreOffer, product: FirestoreProduct, buyer: FirestoreUser | null, seller: FirestoreUser | null}) {
    // This is a simplified timeline. A real app might store a full history array.
    const history = [];

    history.push({
        actor: buyer,
        action: 'Sent an offer',
        amount: offer.amount,
        timestamp: offer.createdAt,
    });
    
    if (offer.status === 'countered' && offer.counterAmount) {
         history.push({
            actor: seller,
            action: 'Countered with',
            amount: offer.counterAmount,
            timestamp: offer.createdAt, // Note: we don't have a timestamp for the counter
        });
    }

    return (
        <div className="space-y-4">
            {history.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={undefined} />
                        <AvatarFallback>{item.actor?.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold text-sm">{item.actor?.name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(item.timestamp.seconds * 1000), 'dd/MM/yy, HH:mm')}</p>
                    </div>
                    <p className="ml-auto font-semibold text-sm underline text-right">{item.action}: {currencyFormatter(item.amount, product.currency)}</p>
                </div>
            ))}
        </div>
    )
}

function OfferActions({ offer, product, userRole }: { offer: FirestoreOffer, product: FirestoreProduct, userRole: 'buyer' | 'seller' | null }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = React.useState<string | null>(null);
    const [isCountering, setIsCountering] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState('');

    const offerRef = doc(firestore, 'products', product.id, 'offers', offer.id);

    const handleUpdateOffer = async (status: FirestoreOffer['status'], amount?: number) => {
        setIsLoading(status);

        let updateData: any = { status };
        if (status === 'countered' && amount) {
            updateData.counterAmount = amount;
        }

        try {
            await updateDoc(offerRef, updateData);
            toast({ title: `Offer ${status}`, description: `The offer has been successfully ${status}.`});
            if (status === 'countered') setIsCountering(false);
        } catch (error) {
            console.error(`Error updating offer to ${status}:`, error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: offerRef.path,
                operation: 'update',
                requestResourceData: updateData,
            }));
            toast({ variant: 'destructive', title: 'Error', description: `Could not update the offer.` });
        } finally {
            setIsLoading(null);
        }
    };
    
    if (!userRole) return null;

    // Buyer's view
    if (userRole === 'buyer') {
        if (offer.status === 'pending') {
            return <Button variant="outline" className="w-full" onClick={() => handleUpdateOffer('withdrawn')} disabled={!!isLoading}>
                {isLoading === 'withdrawn' ? <Loader2 className="animate-spin" /> : 'Withdraw Offer'}
            </Button>;
        }
        if (offer.status === 'countered') {
            return (
                <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => handleUpdateOffer('accepted')} disabled={!!isLoading}>
                        {isLoading === 'accepted' ? <Loader2 className="animate-spin" /> : `Accept ${currencyFormatter(offer.counterAmount!, product.currency)}`}
                    </Button>
                    <Button variant="outline" onClick={() => handleUpdateOffer('rejected')} disabled={!!isLoading}>
                        {isLoading === 'rejected' ? <Loader2 className="animate-spin" /> : 'Decline'}
                    </Button>
                </div>
            );
        }
    }

    // Seller's view
    if (userRole === 'seller' && offer.status === 'pending') {
        if (isCountering) {
            return (
                 <div className="space-y-3 pt-2">
                    <Input 
                        type="number" 
                        placeholder="Your counter offer" 
                        value={counterAmount}
                        onChange={(e) => setCounterAmount(e.target.value)}
                    />
                    <div className="flex gap-2">
                         <Button variant="ghost" onClick={() => setIsCountering(false)} className="w-full">Cancel</Button>
                         <Button 
                            className="w-full"
                            disabled={isLoading === 'countered' || !counterAmount || parseFloat(counterAmount) <= 0}
                            onClick={() => handleUpdateOffer('countered', parseFloat(counterAmount))}
                        >
                            {isLoading === 'countered' ? <Loader2 className="animate-spin" /> : 'Send Counter'}
                        </Button>
                    </div>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-2 gap-3 pt-2">
                <Button onClick={() => handleUpdateOffer('accepted')} disabled={!!isLoading}>
                    {isLoading === 'accepted' ? <Loader2 className="animate-spin" /> : 'Accept'}
                </Button>
                <Button variant="outline" onClick={() => handleUpdateOffer('rejected')} disabled={!!isLoading}>
                    {isLoading === 'rejected' ? <Loader2 className="animate-spin" /> : 'Decline'}
                </Button>
                <Button variant="outline" className="col-span-2" onClick={() => setIsCountering(true)} disabled={!!isLoading}>
                    Make a counter offer
                </Button>
            </div>
        );
    }
    
    return <p className="text-sm text-center text-muted-foreground">This offer has been {offer.status}.</p>;
}


export default function OfferDetailsPage({ params }: { params: { id: string; offerId: string } }) {
    const { id: productId, offerId } = params;
    const { user } = useUser();
    const firestore = useFirestore();

    const productRef = useMemoFirebase(() => firestore ? doc(firestore, 'products', productId) : null, [firestore, productId]);
    const { data: product, isLoading: isProductLoading } = useDoc<FirestoreProduct>(productRef);

    const offerRef = useMemoFirebase(() => firestore ? doc(firestore, 'products', productId, 'offers', offerId) : null, [firestore, productId, offerId]);
    const { data: offer, isLoading: isOfferLoading } = useDoc<FirestoreOffer>(offerRef);

    const buyerId = offer?.buyerId;
    const buyerRef = useMemoFirebase(() => (firestore && buyerId) ? doc(firestore, 'users', buyerId) : null, [firestore, buyerId]);
    const { data: buyer } = useDoc<FirestoreUser>(buyerRef);
    
    const sellerId = product?.sellerId;
    const sellerRef = useMemoFirebase(() => (firestore && sellerId) ? doc(firestore, 'users', sellerId) : null, [firestore, sellerId]);
    const { data: seller } = useDoc<FirestoreUser>(sellerRef);

    const isLoading = isProductLoading || isOfferLoading;
    const userRole = user?.uid === product?.sellerId ? 'seller' : user?.uid === offer?.buyerId ? 'buyer' : null;
    
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
    
    const productImageData = product.images?.[0]?.url ? PlaceHolderImages.find((p) => p.id === product.images[0].url) : null;
    const imageUrl = productImageData?.imageUrl || 'https://placehold.co/80x80/E2E8F0/A0AEC0?text=MARIGO';

    return (
      <div className="container mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
                <Link href={`/products/${productId}`}>
                    <ArrowLeft />
                    <span className="sr-only">Back to product</span>
                </Link>
            </Button>
            <h1 className="text-xl font-bold">Negotiation</h1>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-md bg-muted overflow-hidden">
                    <Image src={imageUrl} alt={product.title} fill sizes="64px" className="object-cover" />
                </div>
                <div>
                    <p className="font-bold">{product.brandId}</p>
                    <p>{product.title}</p>
                    <p className="text-muted-foreground">Listed for: {currencyFormatter(product.price, product.currency)}</p>
                </div>
            </div>
            <Button variant="outline" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact {userRole === 'buyer' ? 'Seller' : 'Buyer'}
            </Button>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Offer History</h3>
            <OfferTimeline offer={offer} product={product} buyer={buyer} seller={seller}/>
        </div>
        
        <div className="border rounded-lg p-4 bg-primary/5">
            <OfferActions offer={offer} product={product} userRole={userRole} />
        </div>
      </div>
    );
}

    