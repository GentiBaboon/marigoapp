'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { FirestoreOrder, FirestoreUser } from '@/lib/types';
import { format } from 'date-fns';
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

const COMMISSION_RATE = 0.15;

export const columns: ColumnDef<FirestoreOrder>[] = [
  {
    accessorKey: 'orderNumber',
    header: 'Transaction ID',
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => {
      const { createdAt } = row.original;
      return createdAt?.toDate ? format(createdAt.toDate(), 'd MMM, yyyy, HH:mm') : 'N/A';
    },
  },
  {
    accessorKey: 'status',
    header: 'Type',
    cell: ({ row }) => {
        const status = row.original.status;
        const type = status === 'refunded' ? 'Refund' : 'Sale';
        return <Badge variant={type === 'Refund' ? 'destructive' : 'secondary'}>{type}</Badge>
    },
  },
   {
    accessorKey: 'buyerId',
    header: 'User',
    cell: ({ row }) => <UserName userId={row.original.buyerId} />,
  },
  {
    accessorKey: 'totalAmount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-right w-full justify-end"
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="text-right">{currencyFormatter.format(row.original.totalAmount)}</div>,
  },
   {
    id: 'commission',
    header: () => <div className="text-right">Commission</div>,
    cell: ({ row }) => {
        const order = row.original;
        const commission = order.status === 'completed' ? order.totalAmount * COMMISSION_RATE : 0;
        return <div className="text-right">{currencyFormatter.format(commission)}</div>
    },
  },
  {
    id: 'payout',
    header: () => <div className="text-right">Seller Payout</div>,
    cell: ({ row }) => {
        const order = row.original;
        const commission = order.status === 'completed' ? order.totalAmount * COMMISSION_RATE : 0;
        const payout = order.status === 'completed' ? order.totalAmount - commission : 0;
        return <div className="text-right">{currencyFormatter.format(payout)}</div>
    },
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment Method',
    cell: ({ row }) => {
        const method = row.original.paymentMethod;
        return <span>{method === 'cod' ? 'Cash on Delivery' : 'Stripe'}</span>
    },
  },
];
