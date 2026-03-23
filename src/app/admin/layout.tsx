'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
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
    return null;
  }

  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-muted/40 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
