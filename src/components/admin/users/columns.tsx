'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FirestoreUser } from '@/lib/types';
import { format } from 'date-fns';
import { DataTableRowActions } from './data-table-row-actions';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1
    ? `${names[0][0]}${names[names.length - 1][0]}`
    : name.substring(0, 2);
};

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

// Mocking some data for display
const mockData = (user: FirestoreUser) => ({
    ...user,
    role: user.email === 'admin@marigo.app' ? 'Admin' : 'Member',
    status: 'Active',
    orders: Math.floor(Math.random() * 50),
    revenue: Math.floor(Math.random() * 5000),
    rating: (Math.random() * (5 - 3.5) + 3.5).toFixed(1)
})

export const columns: ColumnDef<FirestoreUser>[] = [
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
    accessorKey: 'displayName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'user'} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div className="grid">
            <span className="font-medium">{user.displayName}</span>
            <span className="text-muted-foreground text-sm">{user.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <Badge variant="outline">{mockData(row.original).role}</Badge>,
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
   {
    accessorKey: 'createdAt',
    header: 'Join Date',
    cell: ({ row }) => {
      const { createdAt } = row.original;
      return createdAt?.toDate ? format(createdAt.toDate(), 'd MMM, yyyy') : 'N/A';
    },
  },
    {
    accessorKey: 'orders',
    header: 'Orders',
    cell: ({ row }) => mockData(row.original).orders,
  },
  {
    accessorKey: 'revenue',
    header: 'Revenue',
    cell: ({ row }) => currencyFormatter.format(mockData(row.original).revenue),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="secondary">{mockData(row.original).status}</Badge>,
     filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
