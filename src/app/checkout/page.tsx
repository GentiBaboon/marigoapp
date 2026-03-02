
'use client';

import * as React from 'react';
import { CheckoutSteps } from '@/components/checkout/checkout-steps';
import { AddressStep } from '@/components/checkout/address-step';
import { PaymentStep } from '@/components/checkout/payment-step';
import { SummaryStep } from '@/components/checkout/summary-step';
import { OrderSummary } from '@/components/checkout/order-summary';
import { AnimatePresence, motion } from 'framer-motion';
import type { FirestoreAddress } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';

export default function CheckoutPage() {
  const [step, setStep] = React.useState(1);
  const [selectedAddress, setSelectedAddress] = React.useState<FirestoreAddress | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string | null>(null);
  const [savedMethodId, setSavedMethodId] = React.useState<string | null>(null);
  
  const { items, isLoading: isCartLoading } = useCart();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  React.useEffect(() => {
    if (isUserLoading || isCartLoading) return;
    
    if (!user) {
      router.replace('/auth');
    } else if (items.length === 0) {
      router.replace('/cart');
    }
  }, [items, router, user, isUserLoading, isCartLoading]);

  const handleAddressNext = (address: FirestoreAddress) => {
    setSelectedAddress(address);
    setStep(2);
  };

  const handlePaymentNext = (paymentMethod: string, savedId?: string) => {
    setSelectedPaymentMethod(paymentMethod);
    setSavedMethodId(savedId || null);
    setStep(3);
  };
  
  const handleGoToStep = (stepNumber: number) => {
    if (stepNumber > 0 && stepNumber <= 3) {
        setStep(stepNumber);
    }
  }

  if (isUserLoading || isCartLoading || !user || items.length === 0) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="dot-flashing"></div>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="max-w-xl mx-auto mb-12">
        <CheckoutSteps currentStep={step} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-16">
        <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
                 <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {step === 1 && <AddressStep onNextStep={handleAddressNext} />}
                    {step === 2 && <PaymentStep onNextStep={handlePaymentNext} onPrevStep={() => handleGoToStep(1)} />}
                    {step === 3 && (
                        <SummaryStep 
                            onPrevStep={handleGoToStep}
                            shippingAddress={selectedAddress}
                            paymentMethod={selectedPaymentMethod}
                            savedMethodId={savedMethodId}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="lg:col-span-1 mt-12 lg:mt-0">
          <OrderSummary />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
