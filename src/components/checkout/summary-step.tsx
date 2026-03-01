'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, CreditCard, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser, useFirestore } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCurrency } from '@/context/CurrencyContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

type SummaryStepProps = {
  onPrevStep: (step: number) => void;
  shippingAddress: FirestoreAddress | null;
  paymentMethod: string | null;
};

export function SummaryStep({ onPrevStep, shippingAddress, paymentMethod }: SummaryStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { items, grandTotal, clearCart } = useCart();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const functions = getFunctions();
  const { formatPrice } = useCurrency();
  
  const stripe = useStripe();
  const elements = useElements();

  const handleFinaliseOrder = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) return;
    
    setIsLoading(true);
    setErrorMessage(null);

    // 1. If Cash on Delivery, use the existing logic
    if (paymentMethod === 'cod') {
        try {
            const createOrder = httpsCallable(functions, 'createOrder');
            const result: any = await createOrder({
                items: items.map(i => ({ id: i.id, sellerId: i.sellerId, title: i.title, price: i.price })),
                shippingAddress,
                paymentMethod: 'cod'
            });
            clearCart();
            router.push(`/checkout/success/${result.data.orderId}`);
            return;
        } catch (e: any) {
            setErrorMessage(e.message);
            setIsLoading(false);
            return;
        }
    }

    // 2. Stripe Payment Logic
    if (!stripe || !elements) return;

    try {
        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const intentResult: any = await createPaymentIntent({
            items: items.map(i => ({ id: i.id, sellerId: i.sellerId, title: i.title })),
            shippingAddress
        });

        const { clientSecret, orderId } = intentResult.data;

        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: elements.getElement(CardElement)!,
                billing_details: {
                    name: shippingAddress.fullName,
                    email: user.email || undefined,
                },
            },
        });

        if (result.error) {
            setErrorMessage(result.error.message || "Payment failed");
        } else {
            if (result.paymentIntent.status === 'requires_capture' || result.paymentIntent.status === 'succeeded') {
                clearCart();
                toast({ title: "Order Placed!", description: "Funds held in escrow successfully." });
                router.push(`/checkout/success/${orderId}`);
            }
        }
    } catch (error: any) {
        setErrorMessage(error.message || "An unexpected error occurred.");
    } finally {
        setIsLoading(false);
    }
  }

  const paymentLabel = {
      card: 'Credit or Debit Card',
      cod: 'Cash on Delivery',
      apple_pay: 'Apple Pay',
      paypal: 'PayPal',
  }[paymentMethod || 'card'];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Review Your Order</h2>
        <p className="text-muted-foreground text-sm">Confirm your details below to place your order securely.</p>
      </div>

      <div className="grid gap-6">
          <Card className="border-none bg-muted/20 shadow-sm">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-sm uppercase tracking-wider">Shipping To</h3>
                      </div>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(1)}>Change</Button>
                  </div>
                  {shippingAddress && (
                      <div className="text-sm space-y-1">
                          <p className="font-bold text-base">{shippingAddress.fullName}</p>
                          <p className="text-muted-foreground">{shippingAddress.address}</p>
                          <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.postal}, {shippingAddress.country}</p>
                      </div>
                  )}
              </CardContent>
          </Card>

          <Card className="border-none bg-muted/20 shadow-sm">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-sm uppercase tracking-wider">Payment Method</h3>
                      </div>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(2)}>Change</Button>
                  </div>
                  <div className="text-sm font-medium bg-background px-4 py-3 rounded-lg border">
                      {paymentLabel}
                  </div>
              </CardContent>
          </Card>
      </div>

      {errorMessage && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
          </Alert>
      )}

      <div className="space-y-6 pt-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3">
              <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div className="space-y-1">
                  <p className="text-sm font-bold text-green-900">Buyer Protection & Escrow</p>
                  <p className="text-xs text-green-800 leading-relaxed">
                      Your payment is held securely in escrow. The seller is paid only after you receive the item and confirm it's as described.
                  </p>
              </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 rounded-full text-lg font-bold shadow-xl shadow-primary/30"
            onClick={handleFinaliseOrder}
            disabled={isLoading || !stripe}
          >
            {isLoading ? (
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                </div>
            ) : (
                `Confirm & Pay — ${formatPrice(grandTotal)}`
            )}
          </Button>
      </div>
    </div>
  );
}
