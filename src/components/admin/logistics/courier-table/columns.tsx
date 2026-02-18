'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DataTableRowActions } from './data-table-row-actions';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CourierData } from '@/app/admin/logistics/page';


const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1
    ? `${names[0][0]}${names[names.length - 1][0]}`
    : name.substring(0, 2);
};

const statusVariants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  approved: 'default',
  pending_approval: 'secondary',
  rejected: 'destructive',
};

export const courierColumns: ColumnDef<CourierData>[] = [
  {
    accessorKey: 'displayName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Courier
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
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
    id: 'vehicleType',
    header: 'Vehicle',
    cell: ({ row }) => {
        const vehicle = row.original.profile?.vehicleType;
        return vehicle ? <span className="capitalize">{vehicle}</span> : <span className="text-muted-foreground">N/A</span>;
    }
  },
  {
    accessorKey: 'courierStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.courierStatus || 'pending_approval';
      return (
        <Badge variant={statusVariants[status] || 'secondary'}>
          {status.replace('_', ' ')}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
    id: 'joinDate',
    header: 'Join Date',
    accessorFn: (row) => row.createdAt,
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
