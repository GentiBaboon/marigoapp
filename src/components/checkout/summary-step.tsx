'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
        const createOrder = httpsCallable(functions, 'createOrder');
        const result: any = await createOrder(orderData);
        
        clearCart();
        toast({ title: "Order Placed!", description: "Check your email for confirmation." });
        router.push(`/checkout/success/${result.data.orderId}`);
    } catch (error: any) {
        console.error("Order error:", error);
        const msg = error.message || "An unexpected error occurred during checkout.";
        setErrorMessage(msg);
        toast({
            variant: 'destructive',
            title: 'Checkout Failed',
            description: msg,
        });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentLabel = {
      card: 'Credit Card',
      saved_card: 'Saved Card (Visa ****4242)',
      apple_pay: 'Apple Pay',
      cod: 'Cash on Delivery',
      paypal: 'PayPal',
  }[paymentMethod || 'card'];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Review Your Order</h2>
        <p className="text-muted-foreground text-sm">Almost there! Confirm your details below to place your order.</p>
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
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(1)}>Change</Button>
                  </div>
                  {shippingAddress && (
                      <div className="text-sm space-y-1">
                          <p className="font-bold text-base">{shippingAddress.fullName}</p>
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
                  <p className="text-sm font-bold text-green-900">Buyer Protection Included</p>
                  <p className="text-xs text-green-800 leading-relaxed">
                      Your purchase is protected. If the item doesn't arrive or isn't as described, you're covered by our money-back guarantee.
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
                    <span>Processing...</span>
                </div>
            ) : (
                `Pay Now — ${formatPrice(grandTotal)}`
            )}
          </Button>
          
          <p className="text-[10px] text-center text-muted-foreground px-8 leading-relaxed">
              By clicking "Pay Now", you authorize Marigo Luxe to process this transaction. Your payment is held securely in escrow until delivery is confirmed.
          </p>
      </div>
    </div>
  );
}