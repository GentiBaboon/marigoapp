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
import { MapPin, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser, useFirestore } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCurrency } from '@/context/CurrencyContext';

type SummaryStepProps = {
  onPrevStep: (step: number) => void;
  shippingAddress: FirestoreAddress | null;
  paymentMethod: string | null;
};

export function SummaryStep({ onPrevStep, shippingAddress, paymentMethod }: SummaryStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { items, subtotal, totalShipping, grandTotal, clearCart } = useCart();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const functions = getFunctions();
  const { formatPrice } = useCurrency();
  
  const handlePay = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) {
        toast({
            variant: 'destructive',
            title: 'Missing information',
            description: 'Please select a shipping address and payment method.',
        });
        return;
    }

    setIsLoading(true);

    // Clean address data for function payload
    const cleanAddress = {
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        city: shippingAddress.city,
        postal: shippingAddress.postal,
        country: shippingAddress.country,
    };

    const orderPayload = {
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
        shippingAddress: cleanAddress,
    };

    try {
        if (paymentMethod === 'cod') {
            const createOrder = httpsCallable(functions, 'createOrder');
            const result: any = await createOrder(orderPayload);
            const { orderId } = result.data;
            
            toast({
              title: 'Order Placed!',
              description: 'You will pay upon delivery.',
              variant: 'success',
            });
            clearCart();
            router.push(`/checkout/success/${orderId}`);
            return;
        }

        // Card Payment Flow
        if (!stripe || !elements) {
            throw new Error("Stripe context not found. Please refresh.");
        }

        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const intentResult: any = await createPaymentIntent(orderPayload);
        const { clientSecret, orderId } = intentResult.data;
        
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error("Card field not found.");

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
        });

        if (error) throw new Error(error.message);

        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing' || paymentIntent.status === 'requires_capture') {
            toast({
                title: 'Payment Successful!',
                description: 'Your order is being processed.',
                variant: 'success',
            });
            clearCart();
            router.push(`/checkout/success/${orderId}`);
        } else {
             throw new Error(`Unexpected payment status: ${paymentIntent.status}`);
        }

    } catch (error: any) {
        console.error("Checkout processing error:", error);
        // Map common errors
        let displayMessage = error.message || 'An unexpected error occurred.';
        if (error.details?.message) displayMessage = error.details.message;
        
        toast({
            variant: 'destructive',
            title: 'Checkout Failed',
            description: displayMessage,
        });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentMethodLabels: { [key: string]: string } = {
    cod: 'Cash on Delivery',
    new_card: 'Credit or Debit Card',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Order</CardTitle>
          <CardDescription>
            Check your details carefully before confirming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Shipping Address</h4>
                      {shippingAddress ? (
                          <p className="text-sm mt-1">
                              <strong>{shippingAddress.fullName}</strong><br />
                              {shippingAddress.address}, {shippingAddress.city}<br />
                              {shippingAddress.postal}, {shippingAddress.country}
                          </p>
                      ) : (
                          <p className="text-sm text-destructive font-medium">No address selected.</p>
                      )}
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(1)}>Edit</Button>
              </div>
              <Separator />
              <div className="flex items-start gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Payment Method</h4>
                      <p className="text-sm mt-1">{paymentMethod ? paymentMethodLabels[paymentMethod] : 'None selected'}</p>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(2)}>Edit</Button>
              </div>
          </div>
          
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center px-4">
              By confirming your order, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>

        </CardContent>
        <CardFooter className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full bg-black text-white hover:bg-black/90 h-14 text-base font-bold"
              onClick={handlePay}
              disabled={isLoading || !shippingAddress || !paymentMethod}
            >
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Confirm & Pay {formatPrice(grandTotal)}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onPrevStep(2)}
              disabled={isLoading}
            >
              Back
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}