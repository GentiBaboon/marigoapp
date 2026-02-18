'use client';

import { collection, query, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreUser } from '@/lib/types';
import { DataTable } from '@/components/admin/users/data-table';
import { columns } from '@/components/admin/users/columns';
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
