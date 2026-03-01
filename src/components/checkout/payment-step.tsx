'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Apple, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

const paymentMethods = [
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet, subtitle: 'Pay when you receive the item' },
    { id: 'apple_pay', title: 'Apple Pay', icon: Apple, subtitle: 'Fast and secure checkout' },
    { id: 'saved_card', title: 'Saved Visa ending in 4242', icon: CreditCard, subtitle: 'Pay with your saved card' },
    { id: 'card', title: 'Credit or Debit Card', icon: CreditCard, subtitle: 'Visa, Mastercard, Amex' },
    { id: 'paypal', title: 'PayPal', icon: Landmark, subtitle: 'Standard PayPal checkout' },
];

export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('cod');

  return (
    <div className="space-y-6">
        <div className="space-y-1">
            <h2 className="text-2xl font-bold font-headline">Payment Method</h2>
            <p className="text-muted-foreground text-sm">Choose how you would like to pay.</p>
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
                    <Card className="border-primary/20 bg-muted/10 shadow-inner mt-2">
                        <CardContent className="p-6">
                            <p className="text-sm text-muted-foreground text-center">
                                Stripe card entry will appear here in the final version.
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
            Back to Address
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-full text-base font-bold shadow-lg"
            onClick={() => onNextStep(selectedMethod)}
          >
            Continue to Review
          </Button>
        </div>
    </div>
  );
}