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

// Helper component to fetch and display user name
const UserName = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => doc(firestore, 'users', userId), [firestore, userId]);
    const { data: user, isLoading } = useDoc<FirestoreUser>(userRef);

    if (isLoading) return <span className="text-muted-foreground">Loading...</span>;
    return <span>{user?.displayName || userId}</span>;
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
    cell: ({ row }) => <UserName userId={row.original.buyerId} />,
  },
  {
    accessorKey: 'sellerIds',
    header: 'Seller(s)',
    cell: ({ row }) => {
        // For now, just display the first seller.
        const sellerId = row.original.sellerIds[0];
        return <UserName userId={sellerId} />;
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
      const { createdAt } = row.original;
      return createdAt?.toDate ? format(createdAt.toDate(), 'd MMM, yyyy') : 'N/A';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
