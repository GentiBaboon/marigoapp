'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FirestoreUser, getSellerLevel, type BadgeSettings, toDate } from '@/lib/types';
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


const statusVariants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  active: 'secondary',
  banned: 'destructive',
};

const getUserRole = (user: FirestoreUser) => {
    if (user.role === 'admin') return 'Admin';
    if (user.role === 'courier') return 'Courier';
    if (user.isSeller || user.role === 'seller') return 'Seller';
    return 'Customer';
};


// Columns depend on the admin-editable badge settings (labels + thresholds),
// so we build them at render time once the settings doc has loaded. The
// settings argument is nullable — when not available we fall back to the
// hardcoded defaults inside getSellerLevel.
export function buildColumns(badgeSettings: Partial<BadgeSettings> | null): ColumnDef<FirestoreUser>[] {
  return columnsFor(badgeSettings);
}

function columnsFor(badgeSettings: Partial<BadgeSettings> | null): ColumnDef<FirestoreUser>[] {
  return [
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
    accessorKey: 'name',
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
            <AvatarImage src={user.profileImage ?? undefined} alt={user.name ?? 'user'} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="grid">
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground text-sm">{user.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
        const role = getUserRole(row.original);
        return <Badge variant="outline">{role}</Badge>
    },
    filterFn: (row, id, value) => {
        const role = getUserRole(row.original);
        return value.includes(role);
    },
  },
  {
    id: 'badge',
    accessorFn: (row) => getSellerLevel(row, badgeSettings)?.level ?? 'none',
    header: 'Badge',
    cell: ({ row }) => {
        const badge = getSellerLevel(row.original, badgeSettings);
        return badge
          ? <Badge variant="outline">{badge.label}</Badge>
          : <span className="text-muted-foreground text-xs">—</span>;
    },
    filterFn: (row, id, value) => {
        const level = getSellerLevel(row.original, badgeSettings)?.level ?? 'none';
        return value.includes(level);
    },
  },
   {
    accessorKey: 'createdAt',
    // Sortable: this is what "newest first" orders by, and the toolbar's sort
    // control writes into the same state as this header.
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Join Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const { createdAt } = row.original;
      const d = toDate(createdAt);
      return d ? format(d, 'd MMM, yyyy') : 'N/A';
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.original.status || 'active';
        return <Badge variant={statusVariants[status] || 'secondary'}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
    },
     filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
  ];
}

// Backwards-compatible export for callers that don't have badge settings yet.
// Uses the hardcoded defaults inside getSellerLevel.
export const columns = columnsFor(null);
