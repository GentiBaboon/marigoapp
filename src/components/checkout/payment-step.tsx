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
import { Landmark, CreditCard, Apple, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

const paymentMethods = [
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet },
    { id: 'applepay', title: 'Apple Pay', icon: Apple },
    { id: 'card', title: 'Saved Card', description: 'Visa **** 4242', icon: CreditCard },
    { id: 'paypal', title: 'PayPal', icon: Landmark },
    { id: 'new-card', title: 'Pay with new card', icon: CreditCard },
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
