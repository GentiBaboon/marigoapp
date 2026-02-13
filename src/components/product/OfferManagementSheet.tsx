'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, errorEmitter, useDoc, useMemoFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreOffer, FirestoreUser } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';

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

const OfferCard = ({ offer, product, onClose }: { offer: FirestoreOffer, product: FirestoreProduct, onClose: () => void }) => {
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

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={buyer?.profileImage || undefined} />
                    <AvatarFallback>{buyer?.name?.[0] || 'B'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{buyer?.name || 'Buyer'}</p>
                    <p className="text-sm text-muted-foreground">Offer price: {currencyFormatter(offer.amount, product.currency)}</p>
                </div>
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Listing price:</span> <span>{currencyFormatter(product.price, product.currency)}</span></div>
                <div className="flex justify-between font-semibold"><span>You earn:</span> <span>{currencyFormatter(sellerEarning, product.currency)}</span></div>
            </div>
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
                        variant="outline" 
                        onClick={() => handleUpdateOffer('rejected')}
                        disabled={!!isLoading}
                    >
                        {isLoading === 'decline' ? <Loader2 className="animate-spin" /> : 'Decline'}
                    </Button>
                    <Button 
                        onClick={() => handleUpdateOffer('accepted')}
                        disabled={!!isLoading}
                    >
                        {isLoading === 'accept' ? <Loader2 className="animate-spin" /> : 'Accept offer'}
                    </Button>
                    <Button variant="secondary" className="col-span-2" onClick={() => setIsCountering(true)} disabled={!!isLoading}>
                        Make a counter-offer
                    </Button>
                </div>
            )}
        </div>
    )
}


export function OfferManagementSheet({ isOpen, onOpenChange, product, offers }: OfferManagementSheetProps) {
    
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-auto rounded-t-lg p-6">
                 <SheetHeader className="text-left mb-6">
                    <SheetTitle className="text-2xl font-bold">Active Offers</SheetTitle>
                    <SheetDescription>
                        You have {offers.length} active offer(s) on your listing for "{product.title}".
                    </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {offers.map(offer => (
                        <OfferCard key={offer.id} offer={offer} product={product} onClose={() => onOpenChange(false)} />
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    )
}
