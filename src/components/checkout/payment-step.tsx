'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Apple, Landmark, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CardElement } from '@stripe/react-stripe-js';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

const paymentMethods = [
    { id: 'card', title: 'Credit or Debit Card', icon: CreditCard, subtitle: 'Secure payment via Stripe Escrow' },
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet, subtitle: 'Pay when you receive the item' },
    { id: 'apple_pay', title: 'Apple Pay', icon: Apple, subtitle: 'Fast one-tap checkout' },
];

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#32325d",
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4"
      }
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a"
    }
  }
};

export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('card');

  return (
    <div className="space-y-6">
        <div className="space-y-1">
            <h2 className="text-2xl font-bold font-headline">Payment Method</h2>
            <p className="text-muted-foreground text-sm">Choose your preferred payment option.</p>
        </div>
        
        <RadioGroup
          value={selectedMethod}
          onValueChange={setSelectedMethod}
          className="grid gap-4"
        >
          {paymentMethods.map((method) => (
            <Label
              key={method.id}
              htmlFor={method.id}
              className={cn(
                'relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200',
                selectedMethod === method.id 
                    ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                    : 'border-muted bg-background hover:bg-muted/30'
              )}
            >
              <RadioGroupItem value={method.id} id={method.id} className="mr-4" />
              <div className="flex-1 flex items-center justify-between">
                <div className="space-y-0.5">
                    <p className="font-bold text-base">{method.title}</p>
                    <p className="text-xs text-muted-foreground">{method.subtitle}</p>
                </div>
                <method.icon className={cn("h-6 w-6", selectedMethod === method.id ? "text-primary" : "text-muted-foreground")} />
              </div>
            </Label>
          ))}
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
            className="flex-1 h-14 rounded-full text-base font-bold shadow-lg"
            onClick={() => onNextStep(selectedMethod)}
          >
            Review Order
          </Button>
        </div>
    </div>
  );
}
