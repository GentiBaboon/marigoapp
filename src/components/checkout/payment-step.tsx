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
import { CreditCard, Apple, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

// PayPal icon
const PayPalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="h-6 w-auto">
        <path fill="#003087" d="M20.344 6.258c-.297-1.332-1.309-2.22-2.613-2.22H9.27c-.52 0-1.041.34-1.218.846l-3.08 9.539c-.115.356.035.753.39.868l2.969.957c.355.114.753-.035.868-.39l.235-.729a.63.63 0 0 1 .602-.45h.063l4.05-1.236c.356-.115.506-.513.39-.868l-.99-3.06a.63.63 0 0 1 .374-.75l.11-.035c.42-.14.72-.51.68-.96l-.23-1.44c-.03-.2.07-.4.25-.52z"/>
        <path fill="#009cde" d="M21.11 8.358c-.28-1.33-1.25-2.2-2.48-2.2H8.38c-.5 0-1 .32-1.16.8l-1.92 5.95c-.11.34.03.72.37.83l2.84.9c.34.11.72-.04.83-.38l.38-1.16a.6.6 0 0 1 .57-.42h.06l4.2-1.28c.34-.11.48-.5.37-.83l-.94-2.9a.6.6 0 0 1 .35-.7l.11-.04c.4-.13.68-.48.65-.9l-.22-1.38c-.03-.18.06-.38.24-.5z"/>
        <path fill="#012169" d="M12.445 13.118l-3.328 1.018a.63.63 0 0 0-.45.602l.236.729c.115.355.494.558.868.45l2.969-.957a.63.63 0 0 0 .45-.602l-.745-2.24z"/>
    </svg>
)

const paymentMethods = [
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet },
    { id: 'apple_pay', title: 'Apple Pay', icon: Apple },
    { id: 'saved_card', title: 'Saved Card', description: 'Visa **** 4242', icon: CreditCard },
    { id: 'new_card', title: 'Pay with new card', icon: CreditCard },
    { id: 'paypal', title: 'PayPal', icon: PayPalIcon },
];


export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('cod');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>
          Choose how you'd like to pay for your order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedMethod}
          onValueChange={setSelectedMethod}
          className="space-y-4"
        >
          {paymentMethods.map((method) => (
            <Label
              key={method.id}
              htmlFor={method.id}
              className={cn(
                'flex items-start space-x-4 rounded-md border p-4 cursor-pointer transition-colors',
                selectedMethod === method.id && 'border-primary ring-1 ring-primary'
              )}
            >
              <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between">
                    <p className="font-medium flex items-center">
                        {method.title}
                    </p>
                    <method.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                {method.description && (
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                )}
              </div>
            </Label>
          ))}
        </RadioGroup>
        
        <Separator />

        <div className="flex flex-col-reverse md:flex-row gap-4">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={onPrevStep}
          >
            Back to Address
          </Button>
          <Button
            size="lg"
            className="w-full"
            onClick={() => onNextStep(selectedMethod)}
            disabled={!selectedMethod}
          >
            Continue to Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
