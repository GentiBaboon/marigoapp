
import { CheckoutHeader } from '@/components/checkout/checkout-header';
import { StripeProvider } from '@/components/providers/stripe-provider';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StripeProvider>
      <div className="flex flex-col min-h-screen bg-muted/40">
        <CheckoutHeader />
        <main className="flex-1">{children}</main>
      </div>
    </StripeProvider>
  );
}
