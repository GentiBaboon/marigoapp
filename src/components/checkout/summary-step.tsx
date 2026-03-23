'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, CreditCard, Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser, useFirestore } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { useCurrency } from '@/context/CurrencyContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

type SummaryStepProps = {
  onPrevStep: (step: number) => void;
  shippingAddress: FirestoreAddress | null;
  paymentMethod: string | null;
  savedMethodId?: string | null;
};

export function SummaryStep({ onPrevStep, shippingAddress, paymentMethod, savedMethodId }: SummaryStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { items, grandTotal, discountAmount, appliedCoupon, clearCart } = useCart();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const functionsRegion = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(undefined, functionsRegion);
  const { formatPrice } = useCurrency();
  
  const stripe = useStripe();
  const elements = useElements();

  const handleFinaliseOrder = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) return;
    
    setIsLoading(true);
    setErrorMessage(null);

    // Prepare standardized payload for the backend
    const orderPayload = {
        items: items.map(i => ({ 
            id: i.id, 
            sellerId: i.sellerId, 
            title: i.title, 
            price: i.price,
            brand: i.brand,
            image: i.image
        })),
        shippingAddress,
        paymentMethod: paymentMethod === 'cod' ? 'cod' : 'card',
        couponCode: appliedCoupon?.code || null,
        // Backend will re-calculate, but we pass these for audit/comparison
        clientGrandTotal: grandTotal, 
    };

    try {
        // 1. Handle Cash on Delivery (Standard Order)
        if (paymentMethod === 'cod') {
            const createOrder = httpsCallable(functions, 'createOrder');
            const result: any = await createOrder(orderPayload);
            
            if (result.data.success === false) {
                throw new Error(result.data.error || "Order creation failed.");
            }

            clearCart();
            router.push(`/checkout/success/${result.data.orderId}`);
            return;
        }

        // 2. Handle Card Payments (New or Saved) via Stripe Escrow
        if (!stripe) {
            throw new Error("Stripe is not properly initialized. Please refresh.");
        }

        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const intentResult: any = await createPaymentIntent({
            ...orderPayload,
            paymentMethodId: paymentMethod === 'saved_card' ? savedMethodId : undefined
        });

        const { clientSecret, orderId, error: backendError } = intentResult.data;

        if (backendError) {
            throw new Error(backendError);
        }

        let confirmResult;
        if (paymentMethod === 'card' && elements) {
            // New card confirmation
            confirmResult = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement)!,
                    billing_details: {
                        name: shippingAddress.fullName,
                        email: user.email || undefined,
                        phone: shippingAddress.phone || undefined,
                    },
                },
            });
        } else {
            // Saved card or express checkout (already has paymentMethodId on intent)
            confirmResult = await stripe.confirmCardPayment(clientSecret);
        }

        if (confirmResult.error) {
            throw new Error(confirmResult.error.message || "Payment failed at Stripe confirmation step.");
        } 
        
        // Successful payment intent (captured manually later)
        const status = confirmResult.paymentIntent.status;
        if (status === 'requires_capture' || status === 'succeeded') {
            clearCart();
            toast({ title: "Order Confirmed!", description: "Funds are safely held in escrow.", variant: "success" });
            router.push(`/checkout/success/${orderId}`);
        } else {
            throw new Error(`Unexpected payment status: ${status}. Please contact support.`);
        }

    } catch (error: any) {
        console.error("Transaction failed:", error);
        const msg = error?.details?.message || error?.message || "An unexpected system error occurred. Your card was not charged.";
        const friendlyMsg = msg === 'internal'
            ? 'The payment service is temporarily unavailable. Please try again or choose Cash on Delivery.'
            : msg;
        setErrorMessage(friendlyMsg);
        toast({ variant: 'destructive', title: "Order Error", description: friendlyMsg });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentLabel = {
      card: 'New Credit or Debit Card',
      saved_card: 'Saved Payment Method',
      cod: 'Cash on Delivery',
      apple_pay: 'Apple Pay',
      paypal: 'PayPal',
  }[paymentMethod || 'card'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Order Summary</h2>
        <p className="text-muted-foreground text-sm">One final check before we secure your item.</p>
      </div>

      <div className="grid gap-4">
          <Card className="border-none bg-muted/20 shadow-sm overflow-hidden group">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-primary">
                          <MapPin className="h-4 w-4" />
                          <h3 className="font-bold text-xs uppercase tracking-widest">Delivery Address</h3>
                      </div>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-bold text-primary" onClick={() => onPrevStep(1)}>Edit</Button>
                  </div>
                  {shippingAddress && (
                      <div className="text-sm space-y-1">
                          <p className="font-bold text-base text-foreground">{shippingAddress.fullName}</p>
                          <p className="text-muted-foreground leading-tight">{shippingAddress.address}</p>
                          <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.postal}, {shippingAddress.country}</p>
                      </div>
                  )}
              </CardContent>
          </Card>

          <Card className="border-none bg-muted/20 shadow-sm overflow-hidden">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-primary">
                          <CreditCard className="h-4 w-4" />
                          <h3 className="font-bold text-xs uppercase tracking-widest">Payment Method</h3>
                      </div>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-bold text-primary" onClick={() => onPrevStep(2)}>Edit</Button>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold bg-background/80 px-4 py-3 rounded-xl border border-primary/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {paymentLabel}
                  </div>
              </CardContent>
          </Card>
      </div>

      {errorMessage && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 animate-in shake-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
          </Alert>
      )}

      <div className="space-y-6 pt-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex gap-4">
              <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div className="space-y-1">
                  <p className="text-sm font-bold text-green-900">100% Buyer Protection</p>
                  <p className="text-xs text-green-800 leading-relaxed">
                      We hold your payment in a secure escrow account. The seller only receives funds once you've received and verified your luxury item.
                  </p>
              </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 rounded-full text-lg font-bold shadow-xl shadow-primary/30 transition-all active:scale-[0.98]"
            onClick={handleFinaliseOrder}
            disabled={isLoading}
          >
            {isLoading ? (
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Transaction...</span>
                </div>
            ) : (
                `Secure Order — ${formatPrice(grandTotal)}`
            )}
          </Button>
          
          <p className="text-[10px] text-center text-muted-foreground px-8 leading-tight">
              By placing this order, you agree to Marigo's <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Buyer Protection Policy</span>.
          </p>
      </div>
    </div>
  );
}
