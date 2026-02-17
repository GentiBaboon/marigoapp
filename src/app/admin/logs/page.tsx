'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Archive } from 'lucide-react';
import { DataTable } from '@/components/admin/logs/data-table';
import { columns } from '@/components/admin/logs/columns';
import type { FirestoreAdminLog } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import LogsLoading from './loading';


export default function AdminLogsPage() {
  const firestore = useFirestore();
  const logsQuery = useMemoFirebase(
    () => query(collection(firestore, 'admin_logs'), orderBy('timestamp', 'desc')),
    [firestore]
  );
  const { data: logs, isLoading } = useCollection<FirestoreAdminLog>(logsQuery);

  if (isLoading) {
    return <LogsLoading />;
  }

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
