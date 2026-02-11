import { SellFormProvider } from '@/components/sell/SellFormContext';

export default function SellLayout({ children }: { children: React.ReactNode; }) {
  return (
    <SellFormProvider>
      <div className="container mx-auto max-w-lg px-4 py-8">
        {children}
      </div>
    </SellFormProvider>
  );
}
