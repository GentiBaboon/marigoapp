'use client';

import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2 } from 'lucide-react';
import { DataTableViewOptions } from '@/components/admin/users/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/admin/users/data-table-faceted-filter';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

// Canonical order statuses surfaced to admin. `confirmed` is the new name
// for the post-payment "Processing" stage; legacy `processing` orders still
// match because they share rank/labels in `lib/order-status`.
const statuses = [
    { label: 'Pending Payment', value: 'pending_payment' },
    { label: 'Processing', value: 'confirmed' },
    { label: 'In Preparation', value: 'in_preparation' },
    { label: 'Ready to Ship', value: 'prepared' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancellation Requested', value: 'cancel_requested' },
    { label: 'Refund Requested', value: 'refund_requested' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
];


export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const isRowsSelected = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by Order #..."
          value={(table.getColumn('orderNumber')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('orderNumber')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('status') && (
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title="Status"
            options={statuses}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {isRowsSelected && (
            <Button variant="destructive" size="sm" className="h-8">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({table.getFilteredSelectedRowModel().rows.length})
            </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
