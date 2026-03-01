'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Apple, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardElement } from '@stripe/react-stripe-js';
import { Separator } from '@/components/ui/separator';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

const paymentMethods = [
    { id: 'card', title: 'Credit or Debit Card', icon: CreditCard, subtitle: 'Visa, Mastercard, Amex' },
    { id: 'apple_pay', title: 'Apple Pay / Google Pay', icon: Apple, subtitle: 'Fast and secure checkout' },
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet, subtitle: 'Pay when you receive the item' },
];

const cardElementOptions = {
    style: {
        base: {
            color: "#1a1a1a",
            fontFamily: 'Inter, sans-serif',
            fontSmoothing: "antialiased",
            fontSize: "16px",
            "::placeholder": {
                color: "#94a3b8",
            },
        },
        invalid: {
            color: "#ef4444",
            iconColor: "#ef4444",
        },
    },
    hidePostalCode: true,
};

export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('card');

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold font-headline">Payment Method</h2>
        
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
                'relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:bg-muted/30',
                selectedMethod === method.id 
                    ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                    : 'border-muted bg-background'
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
                    <Card className="border-primary/20 bg-muted/10 shadow-inner">
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Card Details</Label>
                                <div className="p-4 bg-background border-2 rounded-xl focus-within:border-primary transition-all shadow-sm">
                                    <CardElement options={cardElementOptions} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <Landmark className="h-3 w-3" />
                                <span>Secured by Stripe with 256-bit encryption. Your data is never stored.</span>
                            </div>
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
            Back to Address
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-full text-base font-bold shadow-xl shadow-primary/20"
            onClick={() => onNextStep(selectedMethod)}
          >
            Continue to Review
          </Button>
        </div>
    </div>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
