import { SellFormProvider } from '@/components/sell/SellFormContext';

export default function SellLayout({ children }: { children: React.ReactNode; }) {
  return (
    <SellFormProvider>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {children}
      </div>
    </SellFormProvider>
  );
}
