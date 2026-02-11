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

export default function CheckoutPage() {
  const [step, setStep] = React.useState(1);
  const [selectedAddress, setSelectedAddress] = React.useState<FirestoreAddress | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string | null>(null);
  const { items } = useCart();
  const router = useRouter();

  React.useEffect(() => {
    if (items.length === 0) {
      router.replace('/cart');
    }
  }, [items, router]);

  const handleAddressNext = (address: FirestoreAddress) => {
    setSelectedAddress(address);
    setStep(2);
  };

  const handlePaymentNext = (paymentMethod: string) => {
    setSelectedPaymentMethod(paymentMethod);
    setStep(3);
  };
  
  const handlePrevStep = () => setStep((prev) => prev - 1);
  
  const stepComponents = [
      <AddressStep key={1} onNextStep={handleAddressNext} />,
      <PaymentStep key={2} onNextStep={handlePaymentNext} onPrevStep={handlePrevStep} />,
      <SummaryStep 
        key={3} 
        onPrevStep={handlePrevStep}
        shippingAddress={selectedAddress}
        paymentMethod={selectedPaymentMethod}
       />,
  ];

  if (items.length === 0) {
    return null; // or a loading spinner while redirecting
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="max-w-xl mx-auto mb-8 md:mb-12">
        <CheckoutSteps currentStep={step} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
        <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
                 <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                >
                    {stepComponents[step - 1]}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="lg:col-span-1 mt-10 lg:mt-0">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}
