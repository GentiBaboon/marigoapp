'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import Loading from './loading';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return <Loading />;
  }
  
  if (!isAdmin) {
      // The hook handles redirection, but as a fallback, we can render an access denied message
      // or simply nothing. Returning null is cleanest as the redirect will happen.
      return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
        {/* We could add a shared Admin sidebar or header here */}
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            {children}
        </main>
    </div>
  );
}
