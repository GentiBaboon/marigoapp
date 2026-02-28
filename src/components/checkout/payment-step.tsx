
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
import { CreditCard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { CardElement } from '@stripe/react-stripe-js';

type PaymentStepProps = {
  onNextStep: (paymentMethod: string) => void;
  onPrevStep: () => void;
};

const paymentMethods = [
    { id: 'new_card', title: 'Pay with new card', icon: CreditCard },
    { id: 'cod', title: 'Cash on Delivery', icon: Wallet },
];

const cardElementOptions = {
    style: {
        base: {
            color: "#32325d",
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            fontSmoothing: "antialiased",
            fontSize: "16px",
            "::placeholder": {
                color: "#aab7c4",
            },
        },
        invalid: {
            color: "#fa755a",
            iconColor: "#fa755a",
        },
    },
};


export function PaymentStep({ onNextStep, onPrevStep }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('new_card');

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
              </div>
            </Label>
          ))}
        </RadioGroup>
        
        {selectedMethod === 'new_card' && (
            <div className="p-4 border rounded-md">
                <CardElement options={cardElementOptions} />
            </div>
        )}
        
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
