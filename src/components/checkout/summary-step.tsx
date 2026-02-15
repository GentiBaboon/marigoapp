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
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { FirestoreAddress, FirestoreOrder } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
  
  const handlePay = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Missing required information to place order.',
        });
        return;
    }

    setIsLoading(true);

    if (paymentMethod === 'cod') {
        // Handle Cash on Delivery
        const newOrder: Omit<FirestoreOrder, 'id'> = {
            orderNumber: `MRG-${Date.now()}`,
            buyerId: user.uid,
            sellerIds: [...new Set(items.map(item => item.sellerId))],
            items: items.map(item => ({
                productId: item.id,
                sellerId: item.sellerId,
                title: item.title,
                brand: item.brand,
                image: item.image,
                price: item.price,
                quantity: item.quantity,
                size: item.selectedSize || null,
            })),
            totalAmount: grandTotal,
            paymentStatus: 'pending',
            paymentMethod,
            status: 'processing', // Or 'pending_cod_confirmation'
            shippingAddress,
            createdAt: new Date(),
        };

        try {
            // This would call a function to save the order
            const createOrder = httpsCallable(functions, 'createOrder'); // Assuming a generic order creation function for COD
            await createOrder({ orderData: newOrder });
            
            toast({
              title: 'Order Placed!',
              description: 'You will pay upon delivery.',
              variant: 'success',
            });
            clearCart();
            // Redirect to a different success page for COD if needed
            router.push(`/checkout/success/cod-order`);
        } catch(error: any) {
             console.error("Error placing COD order:", error);
             toast({
                variant: 'destructive',
                title: 'Uh oh! Something went wrong.',
                description: 'Could not place your order. Please try again.',
             });
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // Handle Stripe payment
    if (!stripe || !elements) {
        toast({ variant: 'destructive', title: 'Stripe not loaded.' });
        setIsLoading(false);
        return;
    }

    try {
        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const result: any = await createPaymentIntent({ items: items.map(i => ({ id: i.id, quantity: i.quantity, sellerId: i.sellerId, title: i.title, brand: i.brand, image: i.image, price: i.price })) });

        const { clientSecret, orderId } = result.data;
        
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            throw new Error("Card element not found");
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
        });

        if (error) {
            throw new Error(error.message);
        }

        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing' || paymentIntent.status === 'requires_capture') {
            await updateDoc(doc(firestore, "orders", orderId), {
                shippingAddress: shippingAddress
            });

            toast({
                title: 'Payment Successful!',
                description: 'Your order is being processed.',
                variant: 'success',
            });
            clearCart();
            router.push(`/checkout/success/${orderId}`);
        } else {
             throw new Error(`Payment failed with status: ${paymentIntent.status}`);
        }

    } catch (error: any) {
        console.error("Payment failed:", error);
        toast({
            variant: 'destructive',
            title: 'Payment Failed',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentMethodLabels: { [key: string]: string } = {
    cod: 'Cash on Delivery',
    apple_pay: 'Apple Pay',
    saved_card: 'Saved Card (Visa **** 4242)',
    new_card: 'New Credit/Debit Card',
    paypal: 'PayPal',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Order</CardTitle>
        <CardDescription>
          Please check the details below before completing your purchase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-4">
           <div className="flex items-start gap-4">
                <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold">Shipping Address</h4>
                    {shippingAddress ? (
                        <p className="text-sm text-muted-foreground">{shippingAddress.fullName}, {shippingAddress.address}, {shippingAddress.city} {shippingAddress.postal}, {shippingAddress.country}</p>
                    ) : (
                        <p className="text-sm text-destructive">No address selected.</p>
                    )}
                </div>
                <Button variant="link" size="sm" className="ml-auto" onClick={() => onPrevStep(1)}>Change</Button>
            </div>
            <Separator />
            <div className="flex items-start gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold">Payment Method</h4>
                    <p className="text-sm text-muted-foreground">{paymentMethod ? paymentMethodLabels[paymentMethod] : 'No payment method selected'}</p>
                </div>
                <Button variant="link" size="sm" className="ml-auto" onClick={() => onPrevStep(2)}>Change</Button>
            </div>
        </div>
        
        <p className="text-xs text-muted-foreground">
            By clicking "Pay Now", you agree to MarigoApp's Terms of Service and Privacy Policy.
        </p>

      </CardContent>
      <CardFooter className="flex-col-reverse md:flex-row gap-4 !pt-0">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => onPrevStep(2)}
            disabled={isLoading}
          >
            Back to Payment
          </Button>
          <Button
            size="lg"
            className="w-full"
            onClick={handlePay}
            disabled={isLoading || !shippingAddress || !paymentMethod || (paymentMethod === 'new_card' && !stripe)}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pay Now - {currencyFormatter.format(grandTotal)}
          </Button>
      </CardFooter>
    </Card>
  );
}
