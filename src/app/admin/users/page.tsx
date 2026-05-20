'use client';

import * as React from 'react';
import { collection, query, limit, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import type { FirestoreUser, BadgeSettings } from '@/lib/types';
import { DataTable } from '@/components/admin/users/data-table';
import { buildColumns } from '@/components/admin/users/columns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import UsersLoading from './loading';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AdminUsersPage() {
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(
    () => query(collection(firestore, 'users'), limit(100)),
    [firestore]
  );
  const { data: users, isLoading: usersLoading } =
    useCollection<FirestoreUser>(usersQuery);

  // Subscribe to admin-editable badge thresholds + labels so the table
  // reflects setting changes live.
  const badgeSettingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'badges') : null),
    [firestore]
  );
  const { data: badgeSettings } = useDoc<BadgeSettings>(badgeSettingsRef);
  const columns = React.useMemo(() => buildColumns(badgeSettings ?? null), [badgeSettings]);

  if (usersLoading) {
    return <UsersLoading />;
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
                <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                <p className="text-muted-foreground">
                    Manage your users and their roles.
                </p>
            </div>
        </div>
      <DataTable columns={columns} data={users || []} />
    </div>
  );
}
