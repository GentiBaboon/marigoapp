'use client';
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
import { CheckCircle, MapPin, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type SummaryStepProps = {
  onPrevStep: () => void;
};

export function SummaryStep({ onPrevStep }: SummaryStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
  const total = 11355; // Mock total for display

  const handlePay = () => {
    toast({
      title: 'Order Placed!',
      description: 'Thank you for your purchase. Your order is being processed.',
      variant: 'success',
    });
    router.push('/home');
  }

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
                    <p className="text-sm text-muted-foreground">Jane Doe, Rruga e Kavajes, Nd 5, H 3, Tirana, 1001, Albania</p>
                </div>
                <Button variant="link" size="sm" className="ml-auto">Change</Button>
            </div>
            <Separator />
            <div className="flex items-start gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold">Payment Method</h4>
                    <p className="text-sm text-muted-foreground">Cash on Delivery</p>
                </div>
                <Button variant="link" size="sm" className="ml-auto">Change</Button>
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
            onClick={onPrevStep}
          >
            Back to Payment
          </Button>
          <Button
            size="lg"
            className="w-full"
            onClick={handlePay}
          >
            Pay Now - {currencyFormatter.format(total)}
          </Button>
      </CardFooter>
    </Card>
  );
}
