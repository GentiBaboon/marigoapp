
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Apple, Landmark, Check, Loader2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { FirestorePaymentMethod } from '@/lib/types';
import { useCart } from '@/context/CartContext';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string, savedMethodId?: string) => void;
  onPrevStep: () => void;
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#0f172a",
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#94a3b8"
      }
    },
    invalid: {
      color: "#ef4444",
      iconColor: "#ef4444"
    }
  }
};

export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useUser();
  const firestore = useFirestore();
  const { grandTotal } = useCart();
  
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<ReturnType<typeof stripe.paymentRequest> | null>(null);

  const paymentMethodsCol = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'paymentMethods');
  }, [user, firestore]);

  const { data: savedCards, isLoading: isCardsLoading } = useCollection<FirestorePaymentMethod>(paymentMethodsCol);

  useEffect(() => {
    if (stripe && grandTotal > 0) {
      const pr = stripe.paymentRequest({
        country: 'IT', // Changed from AL to IT because AL is not currently supported for Stripe PaymentRequest
        currency: 'eur',
        total: {
          label: 'Marigo Luxe Order',
          amount: Math.round(grandTotal * 100),
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then((result) => {
        if (result) {
          setPaymentRequest(pr);
        }
      });
    }
  }, [stripe, grandTotal]);

  useEffect(() => {
    if (savedCards && savedCards.length > 0 && !selectedSavedCardId) {
        const defaultCard = savedCards.find(c => c.isDefault) || savedCards[0];
        setSelectedSavedCardId(defaultCard.id);
        setSelectedMethod('saved_card');
    }
  }, [savedCards, selectedSavedCardId]);

  const handleContinue = () => {
    if (selectedMethod === 'saved_card' && selectedSavedCardId) {
        onNextStep('saved_card', selectedSavedCardId);
    } else {
        onNextStep(selectedMethod);
    }
  };

  return (
    <div className="space-y-6">
        <div className="space-y-1">
            <h2 className="text-2xl font-bold font-headline">Payment Method</h2>
            <p className="text-muted-foreground text-sm">Choose your preferred payment option.</p>
        </div>
        
        {paymentRequest && (
            <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Express Checkout</p>
                <PaymentRequestButtonElement options={{ paymentRequest }} />
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/40 px-2 text-muted-foreground">Or pay with card</span></div>
                </div>
            </div>
        )}

        <RadioGroup
          value={selectedMethod}
          onValueChange={setSelectedMethod}
          className="grid gap-4"
        >
          {/* Saved Cards */}
          {!isCardsLoading && savedCards && savedCards.length > 0 && (
              <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Saved Methods</p>
                  {savedCards.map((card) => (
                      <Label
                        key={card.id}
                        htmlFor={card.id}
                        className={cn(
                            'relative flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
                            selectedMethod === 'saved_card' && selectedSavedCardId === card.id 
                                ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                : 'border-muted bg-background hover:bg-muted/30'
                        )}
                        onClick={() => {
                            setSelectedMethod('saved_card');
                            setSelectedSavedCardId(card.id);
                        }}
                      >
                        <RadioGroupItem value="saved_card" id={card.id} checked={selectedMethod === 'saved_card' && selectedSavedCardId === card.id} className="mr-4" />
                        <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded">
                                    <CreditCard className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm capitalize">{card.brand} •••• {card.last4}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}</p>
                                </div>
                            </div>
                            {card.isDefault && <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded">DEFAULT</span>}
                        </div>
                      </Label>
                  ))}
              </div>
          )}

          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">More Options</p>
          
          <Label
            htmlFor="new-card"
            className={cn(
              'relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200',
              selectedMethod === 'card' 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : 'border-muted bg-background hover:bg-muted/30'
            )}
          >
            <RadioGroupItem value="card" id="new-card" className="mr-4" />
            <div className="flex-1 flex items-center justify-between">
              <div className="space-y-0.5">
                  <p className="font-bold text-base">New Credit or Debit Card</p>
                  <p className="text-xs text-muted-foreground">Secure payment via Stripe Escrow</p>
              </div>
              <CreditCard className={cn("h-6 w-6", selectedMethod === 'card' ? "text-primary" : "text-muted-foreground")} />
            </div>
          </Label>

          <Label
            htmlFor="paypal"
            className={cn(
              'relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200',
              selectedMethod === 'paypal' 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : 'border-muted bg-background hover:bg-muted/30'
            )}
          >
            <RadioGroupItem value="paypal" id="paypal" className="mr-4" />
            <div className="flex-1 flex items-center justify-between">
              <div className="space-y-0.5">
                  <p className="font-bold text-base">PayPal</p>
                  <p className="text-xs text-muted-foreground">Log in to your account</p>
              </div>
              <Globe className={cn("h-6 w-6", selectedMethod === 'paypal' ? "text-primary" : "text-muted-foreground")} />
            </div>
          </Label>

          <Label
            htmlFor="cod"
            className={cn(
              'relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200',
              selectedMethod === 'cod' 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : 'border-muted bg-background hover:bg-muted/30'
            )}
          >
            <RadioGroupItem value="cod" id="cod" className="mr-4" />
            <div className="flex-1 flex items-center justify-between">
              <div className="space-y-0.5">
                  <p className="font-bold text-base">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">Pay when you receive the item</p>
              </div>
              <Wallet className={cn("h-6 w-6", selectedMethod === 'cod' ? "text-primary" : "text-muted-foreground")} />
            </div>
          </Label>
        </RadioGroup>
        
        <AnimatePresence>
            {selectedMethod === 'card' && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                >
                    <Card className="border-primary/20 bg-background shadow-md mt-2">
                        <CardContent className="p-6">
                            <div className="p-4 border rounded-md bg-muted/10">
                                <CardElement options={CARD_ELEMENT_OPTIONS} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-4 text-center">
                                Your payment details are encrypted and processed by Stripe. Marigo Luxe never stores your card information.
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6">
          <Button
            size="lg"
            variant="ghost"
            className="flex-1 h-14 rounded-full font-semibold"
            onClick={onPrevStep}
          >
            Back
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-full text-base font-bold shadow-lg shadow-primary/20"
            onClick={handleContinue}
          >
            Review Order
          </Button>
        </div>
    </div>
  );
}
