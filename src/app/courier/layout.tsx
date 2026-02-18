'use client';

import { useCourierAuth } from '@/hooks/use-courier-auth';
import { CourierNav } from '@/components/courier/CourierNav';
import { Toaster } from '@/components/ui/toaster';

export default function CourierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCourier, isLoading } = useCourierAuth();

  if (isLoading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="dot-flashing"></div>
        </div>
    );
  }
  
  if (!isCourier) {
      return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-muted/40">
        <main className="flex-1 pb-16 md:pb-0">
            <div className="container mx-auto max-w-4xl py-8">
                {children}
            </div>
        </main>
        <CourierNav />
        <Toaster />
    </div>
  );
}
