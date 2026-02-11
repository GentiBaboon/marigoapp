import { CheckoutHeader } from '@/components/checkout/checkout-header';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <CheckoutHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
