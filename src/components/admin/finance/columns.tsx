'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { FirestoreOrder, FirestoreUser } from '@/lib/types';
import { toDate } from '@/lib/types';
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

// Helper component to fetch and display the buyer's name. Guards against
// empty/missing ids (Firestore `doc(...)` throws on empty path) and falls back
// through `name` → `email` → shortened uid so the column never renders blank.
const UserName = ({ userId }: { userId?: string | null }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(
      () => (firestore && userId ? doc(firestore, 'users', userId) : null),
      [firestore, userId],
    );
    const { data: user, isLoading } = useDoc<FirestoreUser>(userRef);

    if (!userId) return <span className="text-muted-foreground">—</span>;
    if (isLoading) return <span className="text-muted-foreground">Loading…</span>;
    return <span>{user?.name || user?.email || `${userId.slice(0, 8)}…`}</span>;
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
      // Use the shared `toDate` helper — it accepts both real Firestore
      // Timestamps and serialized representations (ISO strings, plain objects
      // with seconds/nanoseconds) which sneak in after SSR/JSON round-trips.
      const d = toDate(row.original.createdAt as any);
      return d ? format(d, 'd MMM, yyyy, HH:mm') : 'N/A';
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
        // Show the projected commission on every paid order, not just
        // `completed` ones — the prior gate made every in-flight order render
        // €0.00 and the column looked broken. Refunded orders show a negative
        // (commission was already booked and is being reversed).
        const amount = Number(order.totalAmount) || 0;
        const isRefunded = order.status === 'refunded';
        const isCancelled = order.status === 'cancelled' || order.status === 'payment_failed';
        const commission = isCancelled ? 0 : amount * COMMISSION_RATE * (isRefunded ? -1 : 1);
        return (
          <div className={`text-right ${isRefunded ? 'text-destructive' : ''}`}>
            {currencyFormatter.format(commission)}
          </div>
        );
    },
  },
  {
    id: 'payout',
    header: () => <div className="text-right">Seller Payout</div>,
    cell: ({ row }) => {
        const order = row.original;
        const amount = Number(order.totalAmount) || 0;
        const isRefunded = order.status === 'refunded';
        const isCancelled = order.status === 'cancelled' || order.status === 'payment_failed';
        const commission = isCancelled ? 0 : amount * COMMISSION_RATE;
        const payout = isCancelled ? 0 : (amount - commission) * (isRefunded ? -1 : 1);
        return (
          <div className={`text-right ${isRefunded ? 'text-destructive' : ''}`}>
            {currencyFormatter.format(payout)}
          </div>
        );
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
