'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { FirestoreOrder, FirestoreUser } from '@/lib/types';
import { format } from 'date-fns';
import { DataTableRowActions } from './data-table-row-actions';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const statusVariants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  processing: 'default',
  completed: 'default',
  shipped: 'default',
  delivered: 'default',
  pending_payment: 'secondary',
  payment_failed: 'destructive',
  refunded: 'destructive',
};

// Fetch + display a user's name and email. Email is what admins actually need
// to reach a buyer/seller; the name is kept above it as a soft label.
const UserCell = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => doc(firestore, 'users', userId), [firestore, userId]);
    const { data: user, isLoading } = useDoc<FirestoreUser>(userRef);

    if (isLoading) return <span className="text-muted-foreground text-xs">Loading…</span>;
    if (!user) return <span className="text-muted-foreground text-xs font-mono">{userId.slice(0, 8)}…</span>;

    return (
        <div className="flex flex-col leading-tight">
            <span className="text-sm">{user.name || '—'}</span>
            {user.email && (
                <a
                    href={`mailto:${user.email}`}
                    className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[200px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {user.email}
                </a>
            )}
        </div>
    );
}

export const columns: ColumnDef<FirestoreOrder>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'orderNumber',
    header: 'Order #',
  },
   {
    accessorKey: 'buyerId',
    header: 'Buyer',
    cell: ({ row }) => <UserCell userId={row.original.buyerId} />,
  },
  {
    accessorKey: 'sellerIds',
    header: 'Seller(s)',
    cell: ({ row }) => {
        const ids = Array.from(new Set(row.original.sellerIds || []));
        if (ids.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
            <div className="space-y-1.5">
                {ids.map((id) => <UserCell key={id} userId={id} />)}
            </div>
        );
    }
  },
  {
    accessorKey: 'totalAmount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => currencyFormatter.format(row.original.totalAmount),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={statusVariants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>
    },
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => {
      // Handle every shape the API has historically saved:
      //  - Firestore Timestamp ({ toDate() })
      //  - ISO string ("2026-05-04T...")
      //  - { seconds, nanoseconds } client-side Timestamp
      //  - epoch number
      const raw = row.original.createdAt as any;
      let date: Date | null = null;
      if (!raw) date = null;
      else if (typeof raw.toDate === 'function') date = raw.toDate();
      else if (typeof raw === 'string') {
          const parsed = new Date(raw);
          date = isNaN(parsed.getTime()) ? null : parsed;
      } else if (typeof raw.seconds === 'number') date = new Date(raw.seconds * 1000);
      else if (typeof raw === 'number') date = new Date(raw);

      return date ? format(date, 'd MMM, yyyy') : 'N/A';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
