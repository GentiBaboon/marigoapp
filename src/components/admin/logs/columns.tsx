'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { FirestoreAdminLog } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const actionTypeColors: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  product_approved: 'default',
  product_rejected: 'destructive',
  user_banned: 'destructive',
  user_role_changed: 'secondary',
  order_status_updated: 'default',
  setting_changed: 'secondary',
};

const actionTypeLabels: { [key: string]: string } = {
  product_approved: 'Product Approved',
  product_rejected: 'Product Rejected',
  user_banned: 'User Banned',
  user_role_changed: 'User Role Changed',
  order_status_updated: 'Order Status Updated',
  setting_changed: 'Setting Changed',
};


export const columns: ColumnDef<FirestoreAdminLog>[] = [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Timestamp
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const { timestamp } = row.original;
      return timestamp?.toDate ? format(timestamp.toDate(), 'd MMM, yyyy, HH:mm:ss') : 'N/A';
    },
  },
  {
    accessorKey: 'adminName',
    header: 'Admin',
  },
  {
    accessorKey: 'actionType',
    header: 'Action Type',
    cell: ({ row }) => {
        const type = row.original.actionType;
        return <Badge variant={actionTypeColors[type] || 'outline'}>{actionTypeLabels[type] || type}</Badge>
    },
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
   {
    accessorKey: 'details',
    header: 'Details',
    cell: ({ row }) => <div className="max-w-xs truncate">{row.original.details}</div>
  },
   {
    accessorKey: 'targetId',
    header: 'Target ID',
  },
];
