'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { format } from 'date-fns';
import { DataTableRowActions } from './data-table-row-actions';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const statusVariants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  active: 'default',
  sold: 'secondary',
  reserved: 'secondary',
  pending_review: 'destructive',
};

// Helper component to fetch and display seller name
const SellerName = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerRef = useMemoFirebase(() => doc(firestore, 'users', sellerId), [firestore, sellerId]);
    const { data: seller, isLoading } = useDoc<FirestoreUser>(sellerRef);

    if (isLoading) return <span className="text-muted-foreground">Loading...</span>;
    return <span>{seller?.displayName || sellerId}</span>;
}

export const columns: ColumnDef<FirestoreProduct>[] = [
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
    accessorKey: 'title',
    header: 'Product',
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 flex-shrink-0">
             <Image 
                src={product.images?.[0] || '/placeholder.png'} 
                alt={product.title} 
                fill
                sizes="64px"
                className="rounded-md object-cover bg-muted"
            />
          </div>
          <div className="grid">
            <span className="font-medium">{product.title}</span>
            <span className="text-muted-foreground text-sm">{product.brand}</span>
          </div>
        </div>
      );
    },
  },
   {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <SellerName sellerId={row.original.sellerId} />,
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'price',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => currencyFormatter.format(row.original.price),
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
    accessorKey: 'listingCreated',
    header: 'Date',
    cell: ({ row }) => {
      const { listingCreated } = row.original;
      return listingCreated?.toDate ? format(listingCreated.toDate(), 'd MMM, yyyy') : 'N/A';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
