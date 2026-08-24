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
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { useCurrency } from '@/context/CurrencyContext';
import { notifyUser } from '@/lib/notifications';
import { notifyOfferEmail } from '@/lib/offer-notify';
import {
  historyEntry,
  offerExpiresAt,
  validateOfferAmount,
  OPEN_STATUSES,
} from '@/lib/offers';

interface MakeOfferSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    price: number;
    brand: string;
    sellerId: string;
    title?: string;
  };
}

export function MakeOfferSheet({ isOpen, onOpenChange, product }: MakeOfferSheetProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [selectedOffer, setSelectedOffer] = React.useState<number | null>(null);
  const [customOffer, setCustomOffer] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { formatPrice, currency, rates } = useCurrency();

  const isOwnListing = !!user && user.uid === product.sellerId;

  /**
   * Prices are stored in EUR; the shopper sees and types their own currency.
   * The preset buttons are computed in EUR and merely *displayed* converted,
   * but the custom field is the other direction — a number typed as "3000"
   * beside a "3.069 ALL" button means 3000 lekë, not €3000. Converting it back
   * is what stops a 5% haggle being stored as an offer ~93× the asking price.
   */
  const rate = rates?.[currency] ?? (currency === 'ALL' ? 93 : 1);
  const toEur = React.useCallback((displayAmount: number) => displayAmount / (rate || 1), [rate]);
  const toDisplay = React.useCallback((eur: number) => eur * (rate || 1), [rate]);

  const suggestedOffers = React.useMemo(() => {
    const price = product.price;
    return [
      { percentage: 5, value: Math.round(price * 0.95 * 100) / 100 },
      { percentage: 10, value: Math.round(price * 0.90 * 100) / 100 },
      { percentage: 15, value: Math.round(price * 0.85 * 100) / 100 },
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
  };

  const handleSelectOffer = (value: number) => {
    setSelectedOffer(value);
    setCustomOffer('');
  };

  const handleCustomOfferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomOffer(value);
    const typed = Number(value);
    if (value && !isNaN(typed) && typed > 0) {
      setSelectedOffer(toEur(typed));
    } else if (!value) {
      setSelectedOffer(suggestedOffers[0].value);
    } else {
      setSelectedOffer(null);
    }
  };

  /** Validation runs on the EUR figure, but speaks to the user in their own
   *  currency, so the error and the button never quote different numbers. */
  const amountCheck = React.useMemo(
    () => validateOfferAmount(selectedOffer ?? NaN, product.price),
    [selectedOffer, product.price],
  );

  const handleSendOffer = async () => {
    if (!user || !firestore || isLoading) return;

    if (isOwnListing) {
      toast({
        variant: 'destructive',
        title: 'This is your listing',
        description: 'You cannot make an offer on an item you are selling.',
      });
      return;
    }

    if (!amountCheck.ok) {
      toast({ variant: 'destructive', title: 'Invalid offer', description: amountCheck.reason });
      return;
    }

    const amount = Math.round((selectedOffer as number) * 100) / 100;
    setIsLoading(true);

    const offersCollection = collection(firestore, 'products', product.id, 'offers');

    try {
      // One live negotiation per buyer per item. Without this the seller gets
      // a fresh row every time the sheet is opened, and neither side can tell
      // which one is the real conversation.
      const existing = await getDocs(
        query(offersCollection, where('buyerId', '==', user.uid), where('status', 'in', OPEN_STATUSES), limit(1)),
      );
      if (!existing.empty) {
        onOpenChange(false);
        toast({
          title: 'You already have an offer on this item',
          description: 'Opening your existing negotiation.',
        });
        router.push(`/products/${product.id}/offers/${existing.docs[0].id}`);
        return;
      }

      const offerData = {
        productId: product.id,
        buyerId: user.uid,
        buyerName: user.displayName || 'A buyer',
        sellerId: product.sellerId,
        // Both names are written: `offerAmount` is what this app reads,
        // `amount` is what FirestoreOffer has always declared. Dropping either
        // silently empties one of the two list screens.
        offerAmount: amount,
        amount,
        originalListingPrice: product.price,
        status: 'pending' as const,
        offerType: customOffer !== '' ? 'custom' : 'preset',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(offerExpiresAt()),
        history: [
          historyEntry({ action: 'created', amount, byUser: user.uid, byRole: 'buyer' }),
        ],
      };

      const docRef = await addDoc(offersCollection, offerData);

      // Both are best-effort and deliberately not awaited into the failure
      // path: the offer is already saved, and a missed notification must not
      // be reported to the buyer as a failed offer.
      void notifyUser({
        firestore,
        userId: product.sellerId,
        type: 'offer_received',
        title: `New offer: ${formatPrice(amount)}`,
        message: `${user.displayName || 'A buyer'} offered ${formatPrice(amount)} for ${product.title || 'your item'}.`,
        link: `/products/${product.id}/offers/${docRef.id}`,
      });
      void notifyOfferEmail(user, { productId: product.id, offerId: docRef.id, event: 'created' });

      onOpenChange(false);
      router.push(`/products/${product.id}/offers/${docRef.id}`);
    } catch (error: any) {
      console.error('Error sending offer:', error);
      // Only a genuine rules rejection belongs on the permission channel.
      // Reporting every failure as one is what disguised an SDK validation
      // error as "Missing or insufficient permissions" and sent the hunt for
      // this bug into firestore.rules.
      if (error?.code === 'permission-denied') {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: `products/${product.id}/offers`,
            operation: 'create',
            requestResourceData: { buyerId: user.uid, offerAmount: amount },
          }),
        );
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error?.code === 'permission-denied'
            ? 'You are not allowed to make an offer on this item.'
            : 'Failed to send offer. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const customPlaceholder = `Custom offer (${currency})`;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-lg p-6">
        {!user && !isUserLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <SheetHeader>
              <SheetTitle>Make an Offer</SheetTitle>
              <SheetDescription>You must be logged in to make an offer.</SheetDescription>
            </SheetHeader>
            <Button className="mt-6" onClick={handleAuthRedirect}>Sign In to Continue</Button>
          </div>
        )}
        {isUserLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {user && isOwnListing && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <SheetHeader>
              <SheetTitle>This is your listing</SheetTitle>
              <SheetDescription>You cannot make an offer on an item you are selling.</SheetDescription>
            </SheetHeader>
            <Button className="mt-6" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
        {user && !isOwnListing && (
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
                    type="button"
                    onClick={() => handleSelectOffer(offer.value)}
                    className={cn(
                      'p-3 border rounded-md transition-colors space-y-1',
                      selectedOffer === offer.value && customOffer === ''
                        ? 'border-primary ring-1 ring-primary bg-green-50/50'
                        : 'border-input bg-background',
                    )}
                  >
                    <p className="font-bold text-lg">{formatPrice(offer.value)}</p>
                    <p className="text-sm text-muted-foreground">{offer.percentage}% off</p>
                    {index === 0 && (
                      <p className="text-xs text-green-700 font-medium mt-1">Recommended</p>
                    )}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Pencil className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={customPlaceholder}
                  value={customOffer}
                  onChange={handleCustomOfferChange}
                  /* ≥16px, or iOS Safari zooms the page and shoves the sheet
                     sideways — see CLAUDE.md §13. */
                  className="pl-11 h-14 text-base"
                />
              </div>

              {!amountCheck.ok && (selectedOffer !== null || customOffer !== '') && (
                <p className="text-sm text-destructive">{amountCheck.reason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Listed at {formatPrice(product.price)}. Offers expire after 7 days.
              </p>
            </div>
            <SheetFooter className="mt-6">
              <Button
                size="lg"
                className="w-full bg-foreground text-background text-base h-14"
                onClick={handleSendOffer}
                disabled={isLoading || !amountCheck.ok}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                Send {selectedOffer && amountCheck.ok ? formatPrice(selectedOffer) : ''} offer
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
