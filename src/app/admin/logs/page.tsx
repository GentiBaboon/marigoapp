'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Archive } from 'lucide-react';
import { DataTable } from '@/components/admin/logs/data-table';
import { columns } from '@/components/admin/logs/columns';
import { FirestoreAdminLog } from '@/lib/types';
import { subDays } from 'date-fns';

const mockLogs: FirestoreAdminLog[] = [
  { id: 'log-1', adminId: '2C81RVoXZWZuSWXEEueehqbHkMu1', adminName: 'Genti Selenica', actionType: 'user_banned', details: 'Banned user "SpammyUser123" for spam.', targetId: 'user-456', timestamp: { toDate: () => subDays(new Date(), 1) } },
  { id: 'log-2', adminId: '2C81RVoXZWZuSWXEEueehqbHkMu1', adminName: 'Genti Selenica', actionType: 'product_rejected', details: 'Rejected product "Luxury Handbag" as counterfeit.', targetId: 'prod-123', timestamp: { toDate: () => subDays(new Date(), 2) } },
  { id: 'log-3', adminId: '2C81RVoXZWZuSWXEEueehqbHkMu1', adminName: 'Genti Selenica', actionType: 'setting_changed', details: 'Updated commission rate to 18%.', targetId: 'commission-rate', timestamp: { toDate: () => subDays(new Date(), 3) } },
  { id: 'log-4', adminId: '2C81RVoXZWZuSWXEEueehqbHkMu1', adminName: 'Genti Selenica', actionType: 'order_status_updated', details: 'Updated order #ORD-12345 to "Shipped".', targetId: 'ORD-12345', timestamp: { toDate: () => subDays(new Date(), 4) } },
];


export default function AdminLogsPage() {
  // In a real app, you would fetch logs from Firestore
  // const { data: logs, isLoading } = useCollection...
  const logs = mockLogs;
  const isLoading = false;

  return (
    <div className="space-y-4">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
                <Link href="/admin">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Archive className="h-6 w-6" />
                    Activity Log
                </h1>
                <p className="text-muted-foreground">
                    An immutable record of all administrator actions.
                </p>
            </div>
        </div>
      <DataTable columns={columns} data={logs || []} />
    </div>
  );
}
