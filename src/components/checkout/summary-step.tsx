'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, CreditCard, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser, useFirestore } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCurrency } from '@/context/CurrencyContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const stripe = useStripe();
  const elements = useElements();
  const functions = getFunctions();
  const { formatPrice } = useCurrency();
  
  const handleFinaliseOrder = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) return;
    
    setIsLoading(true);
    setErrorMessage(null);

    const orderData = {
        items: items.map(item => ({
            id: item.id,
            sellerId: item.sellerId,
            title: item.title,
            brand: item.brand,
            image: item.image,
            price: item.price,
            quantity: item.quantity,
            size: item.selectedSize || null,
        })),
        shippingAddress: {
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            address: shippingAddress.address,
            city: shippingAddress.city,
            postal: shippingAddress.postal,
            country: shippingAddress.country,
        },
        paymentMethod,
    };

    try {
        if (paymentMethod === 'cod') {
            const createOrder = httpsCallable(functions, 'createOrder');
            const result: any = await createOrder(orderData);
            clearCart();
            router.push(`/checkout/success/${result.data.orderId}`);
            return;
        }

        if (!stripe || !elements) throw new Error("Payment system not ready. Please refresh.");

        // 1. Create PaymentIntent on Backend
        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const intentResult: any = await createPaymentIntent(orderData);
        const { clientSecret, orderId } = intentResult.data;

        // 2. Confirm Payment with Stripe Elements
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error("Card information missing.");

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: shippingAddress.fullName,
                    email: user.email || '',
                    phone: shippingAddress.phone,
                    address: {
                        line1: shippingAddress.address,
                        city: shippingAddress.city,
                        postal_code: shippingAddress.postal,
                        country: 'AL', // Defaulting to AL for MVP
                    }
                }
            }
        });

        if (stripeError) {
            throw new Error(stripeError.message);
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
            clearCart();
            router.push(`/checkout/success/${orderId}`);
        } else {
            throw new Error("Payment was not successful. Please try again.");
        }

    } catch (error: any) {
        console.error("Order error:", error);
        setErrorMessage(error.message || "An unexpected error occurred during checkout.");
        toast({
            variant: 'destructive',
            title: 'Checkout Failed',
            description: error.message || "Could not complete your order.",
        });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentLabel = {
      card: 'Credit Card (Stripe)',
      apple_pay: 'Apple/Google Pay',
      cod: 'Cash on Delivery',
  }[paymentMethod || 'card'];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Review Your Order</h2>
        <p className="text-muted-foreground">Almost done! Confirm your details below.</p>
      </div>

      <div className="grid gap-6">
          {/* Shipping Summary */}
          <Card className="border-none bg-muted/20 shadow-sm">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-sm uppercase tracking-wider">Shipping To</h3>
                      </div>
                      <Button variant="link" size="sm" onClick={() => onPrevStep(1)}>Change</Button>
                  </div>
                  {shippingAddress && (
                      <div className="text-sm space-y-1">
                          <p className="font-bold">{shippingAddress.fullName}</p>
                          <p className="text-muted-foreground">{shippingAddress.address}</p>
                          <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.postal}, {shippingAddress.country}</p>
                          <p className="text-xs text-muted-foreground pt-2">{shippingAddress.phone}</p>
                      </div>
                  )}
              </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card className="border-none bg-muted/20 shadow-sm">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-sm uppercase tracking-wider">Payment Method</h3>
                      </div>
                      <Button variant="link" size="sm" onClick={() => onPrevStep(2)}>Change</Button>
                  </div>
                  <div className="text-sm font-medium">
                      {paymentLabel}
                  </div>
              </CardContent>
          </Card>
      </div>

      {errorMessage && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
          </Alert>
      )}

      <div className="space-y-6 pt-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3">
              <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div className="space-y-1">
                  <p className="text-sm font-bold text-green-900">Buyer Protection Enabled</p>
                  <p className="text-xs text-green-800 leading-relaxed">
                      Your funds are held in a secure escrow account and only released to the seller after you confirm receipt.
                  </p>
              </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 rounded-full text-lg font-bold shadow-xl shadow-primary/30"
            onClick={handleFinaliseOrder}
            disabled={isLoading}
          >
            {isLoading ? (
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Order...</span>
                </div>
            ) : (
                `Complete Purchase — ${formatPrice(grandTotal)}`
            )}
          </Button>
          
          <p className="text-[10px] text-center text-muted-foreground px-8 leading-relaxed">
              By clicking "Complete Purchase", you authorize Marigo Luxe to process this transaction. Orders paid via card are protected by our Money-Back Guarantee.
          </p>
      </div>
    </div>
  );
}
