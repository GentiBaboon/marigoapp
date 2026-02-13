'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, errorEmitter, useDoc, useMemoFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreOffer, FirestoreUser } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';

interface OfferManagementSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: FirestoreProduct;
  offers: FirestoreOffer[];
}

const currencyFormatter = (value: number, currency: string = 'EUR') => new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency,
}).format(value);

const COMMISSION_RATE = 0.20;
const FIXED_FEE = 5;

const PriceNegotiationView = ({ offer, product, onClose }: { offer: FirestoreOffer, product: FirestoreProduct, onClose: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState<null | 'accept' | 'decline' | 'counter'>(null);
    const [isCountering, setIsCountering] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState<string>('');
    
    const buyerRef = useMemoFirebase(() => firestore ? doc(firestore, 'users', offer.buyerId) : null, [firestore, offer.buyerId]);
    const { data: buyer } = useDoc<FirestoreUser>(buyerRef);

    const offerRef = doc(firestore, 'products', product.id, 'offers', offer.id);

    const handleUpdateOffer = async (status: 'accepted' | 'rejected' | 'countered', amount?: number) => {
        const loadingState = status === 'accepted' ? 'accept' : status === 'rejected' ? 'decline' : 'counter';
        setIsLoading(loadingState);

        let updateData: any = { status };
        if (status === 'countered' && amount) {
            updateData.counterAmount = amount;
            updateData.status = 'countered'; // Explicitly set
        }

        try {
            await updateDoc(offerRef, updateData);
            toast({ title: `Offer ${status}`, description: `The offer has been ${status}.`});
            onClose();
        } catch (error) {
            console.error(`Error ${status} offer:`, error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: offerRef.path,
                operation: 'update',
                requestResourceData: updateData,
            }));
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${status} the offer.` });
        } finally {
            setIsLoading(null);
        }
    };
    
    const sellerEarning = offer.amount - (offer.amount * COMMISSION_RATE) - FIXED_FEE;
    const productImageData = product.images?.[0]?.url ? PlaceHolderImages.find((p) => p.id === product.images[0].url) : null;
    const imageUrl = productImageData?.imageUrl || 'https://placehold.co/80x80/E2E8F0/A0AEC0?text=MARIGO';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md">
                     <Image src={imageUrl} alt={product.title} fill sizes="80px" className="object-cover rounded-md" />
                </div>
                <div>
                    <p className="font-bold text-lg">{product.brandId}</p>
                    <p>{product.title}</p>
                    <p className="text-muted-foreground">Price: {currencyFormatter(product.price, product.currency)}</p>
                </div>
            </div>

             <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
                <p className="font-semibold">
                    Offer received <span className="text-primary">{currencyFormatter(offer.amount, product.currency)}</span>
                </p>
                <p className="text-sm">(You earn: {currencyFormatter(sellerEarning, product.currency)})</p>
                <p className="text-sm text-destructive font-semibold">This is your last chance to negotiate</p>
                <p className="text-sm text-muted-foreground">You have 2 days to respond.</p>
                
                 {isCountering ? (
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
                                disabled={isLoading === 'counter' || !counterAmount || parseFloat(counterAmount) <= 0}
                                onClick={() => handleUpdateOffer('countered', parseFloat(counterAmount))}
                            >
                                {isLoading === 'counter' ? <Loader2 className="animate-spin" /> : 'Send Counter'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button 
                            onClick={() => handleUpdateOffer('accepted')}
                            disabled={!!isLoading}
                            className="bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isLoading === 'accept' ? <Loader2 className="animate-spin" /> : 'Accept'}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleUpdateOffer('rejected')}
                            disabled={!!isLoading}
                        >
                            {isLoading === 'decline' ? <Loader2 className="animate-spin" /> : 'Decline'}
                        </Button>
                        <Button variant="outline" className="col-span-2" onClick={() => setIsCountering(true)} disabled={!!isLoading}>
                            Make a counter offer
                        </Button>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-4">Offer History</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={buyer?.profileImage || undefined} />
                            <AvatarFallback>{buyer?.name?.[0] || 'B'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm">{buyer?.name}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(offer.createdAt.seconds * 1000), 'dd/MM/yy, HH:mm')}</p>
                        </div>
                        <p className="ml-auto font-semibold text-sm underline">Offer stands {currencyFormatter(offer.amount, product.currency)}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}


export function OfferManagementSheet({ isOpen, onOpenChange, product, offers }: OfferManagementSheetProps) {
    
    // For now, we only show negotiation for the first offer in the list.
    // A real implementation might need a way to switch between multiple negotiations.
    const offerToNegotiate = offers[0];

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-lg p-4">
                 <SheetHeader className="text-left mb-4 flex-row items-center justify-between">
                    <SheetTitle className="text-xl font-bold">Start a price negotiation</SheetTitle>
                     <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        <X className="h-5 w-5" />
                    </Button>
                </SheetHeader>
                <div className="overflow-y-auto pb-6">
                    {offerToNegotiate ? (
                        <PriceNegotiationView offer={offerToNegotiate} product={product} onClose={() => onOpenChange(false)} />
                    ) : (
                        <p>No active offers to display.</p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
