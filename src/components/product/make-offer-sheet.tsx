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
import { cn } from '@/lib/utils';
import { Pencil, Send, Loader2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface MakeOfferSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    price: number;
    brand: string;
    seller_id: string;
  };
}

const currencyFormatter = (value: number) => new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value);

export function MakeOfferSheet({ isOpen, onOpenChange, product }: MakeOfferSheetProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [selectedOffer, setSelectedOffer] = React.useState<number | null>(null);
  const [customOffer, setCustomOffer] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);

  const suggestedOffers = React.useMemo(() => {
    const price = product.price;
    return [
      { percentage: 5, value: Math.round(price * 0.95) },
      { percentage: 10, value: Math.round(price * 0.90) },
      { percentage: 15, value: Math.round(price * 0.85) },
    ];
  }, [product.price]);

  React.useEffect(() => {
    if (isOpen) {
        setSelectedOffer(suggestedOffers[0].value);
        setCustomOffer('');
    }
  }, [isOpen, suggestedOffers]);
  
  const handleAuthRedirect = () => {
    onOpenChange(false);
    router.push('/auth');
  }

  const handleSelectOffer = (value: number) => {
    setSelectedOffer(value);
    setCustomOffer('');
  };

  const handleCustomOfferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomOffer(value);
    if (value && !isNaN(Number(value)) && Number(value) > 0) {
        setSelectedOffer(Number(value));
    } else if (!value) {
        // When custom input is cleared, fall back to recommended
        setSelectedOffer(suggestedOffers[0].value);
    } else {
        setSelectedOffer(null);
    }
  }
  
  const handleSendOffer = async () => {
    if (!user || !firestore) {
      return;
    }
    
    if (!selectedOffer || selectedOffer <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Offer',
        description: 'Please enter a valid offer amount.',
      });
      return;
    }

    setIsLoading(true);

    const now = serverTimestamp();
    const offerData = {
      buyer_id: user.uid,
      seller_id: product.seller_id,
      offer_amount: selectedOffer,
      status: 'pending',
      created_at: now,
      history: [{
          action: 'created',
          amount: selectedOffer,
          by_user: user.uid,
          timestamp: now
      }],
      product_id: product.id,
      original_listing_price: product.price,
      offer_type: customOffer !== '' ? 'custom' : 'preset_1', // This is a guess but reasonable.
    };

    try {
      const offersCollection = collection(firestore, 'products', product.id, 'offers');
      const docRef = await addDoc(offersCollection, offerData);
      onOpenChange(false);
      router.push(`/products/${product.id}/offers/${docRef.id}`);
    } catch (error) {
      console.error('Error sending offer:', error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `products/${product.id}/offers`,
        operation: 'create',
        requestResourceData: offerData,
      }));
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send offer. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-lg p-6">
         {!user && !isUserLoading && (
             <div className="flex flex-col items-center justify-center py-8 text-center">
                <SheetHeader>
                    <SheetTitle>Make an Offer</SheetTitle>
                    <SheetDescription>
                        You must be logged in to make an offer.
                    </SheetDescription>
                </SheetHeader>
                <Button className="mt-6" onClick={handleAuthRedirect}>Sign In to Continue</Button>
            </div>
         )}
         {isUserLoading && (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
         )}
        {user && (
            <>
                <SheetHeader className="text-left mb-6">
                <SheetTitle className="text-2xl font-bold">Make an offer</SheetTitle>
                <SheetDescription>
                    Our recommendation increases the likelihood of an accepted offer.
                </SheetDescription>
                </SheetHeader>
                <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                    {suggestedOffers.map((offer, index) => (
                    <button
                        key={offer.percentage}
                        onClick={() => handleSelectOffer(offer.value)}
                        className={cn(
                        'p-3 border rounded-md transition-colors space-y-1',
                        selectedOffer === offer.value && customOffer === '' ? 'border-primary ring-1 ring-primary bg-green-50/50' : 'border-input bg-background',
                        )}
                    >
                        <p className="font-bold text-lg">{currencyFormatter(offer.value)}</p>
                        <p className="text-sm text-muted-foreground">{offer.percentage}% off</p>
                        {index === 0 && <p className="text-xs text-green-700 font-medium mt-1">Recommended</p>}
                    </button>
                    ))}
                </div>

                <div className="relative">
                    <Pencil className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                    type="number"
                    placeholder="Custom offer"
                    value={customOffer}
                    onChange={handleCustomOfferChange}
                    className="pl-11 h-14 text-base"
                    />
                </div>
                </div>
                <SheetFooter className="mt-6">
                <Button
                    size="lg"
                    className="w-full bg-foreground text-background text-base h-14"
                    onClick={handleSendOffer}
                    disabled={isLoading || !selectedOffer || selectedOffer <= 0}
                >
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-5 w-5" />}
                    Send {selectedOffer ? currencyFormatter(selectedOffer) : ''} offer
                </Button>
                </SheetFooter>
            </>
        )}
      </SheetContent>
    </Sheet>
  );
}
