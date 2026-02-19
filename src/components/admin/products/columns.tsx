'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { format } from 'date-fns';
import { DataTableRowActions } from './data-table-row-actions';
import { ArrowUpDown, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

// Helper component to fetch and display seller name
const SellerName = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerRef = useMemoFirebase(() => doc(firestore, 'users', sellerId), [firestore, sellerId]);
    const { data: seller, isLoading } = useDoc<FirestoreUser>(sellerRef);

    if (isLoading) return <span className="text-muted-foreground">Loading...</span>;
    return <span>{seller?.displayName || 'Unknown Seller'}</span>;
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
          <div className="relative h-10 w-10 flex-shrink-0">
             <Image 
                src={product.images?.[0] || '/placeholder.png'} 
                alt={product.title} 
                fill
                sizes="40px"
                className="rounded-md object-cover bg-muted"
            />
          </div>
          <span className="font-medium">{product.title}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'brand',
    header: 'Brand',
  },
   {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <SellerName sellerId={row.original.sellerId} />,
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
        const statusConfig = {
            'pending_review': { icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
            'active': { icon: CheckCircle, className: 'bg-green-100 text-green-800' },
            'sold': { icon: null, className: 'bg-gray-100 text-gray-800' },
            'rejected': { icon: null, className: 'bg-red-100 text-red-800' },
            'reserved': { icon: null, className: 'bg-blue-100 text-blue-800' }
        }[status] || { icon: null, className: 'bg-gray-100 text-gray-800' };

        const Icon = statusConfig.icon;

        return <Badge variant="outline" className={cn('capitalize border-transparent', statusConfig.className)}>
            {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
            {status.replace('_', ' ')}
        </Badge>
    },
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
      accessorKey: 'views',
      header: 'Views',
      cell: ({ row }) => row.original.views || 0,
  },
  {
      accessorKey: 'likes',
      header: 'Likes',
      cell: ({ row }) => row.original.likes || 0,
  },
  {
    accessorKey: 'listingCreated',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Listed On
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
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
