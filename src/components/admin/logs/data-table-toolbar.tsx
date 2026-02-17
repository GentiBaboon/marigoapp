'use client';

import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { DataTableViewOptions } from '@/components/admin/users/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/admin/users/data-table-faceted-filter';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const actionTypes = [
    { label: 'Product Approved', value: 'product_approved' },
    { label: 'Product Rejected', value: 'product_rejected' },
    { label: 'User Banned', value: 'user_banned' },
    { label: 'User Role Changed', value: 'user_role_changed' },
    { label: 'Order Status Updated', value: 'order_status_updated' },
    { label: 'Setting Changed', value: 'setting_changed' },
];


export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by details or ID..."
          value={(table.getColumn('details')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('details')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('actionType') && (
          <DataTableFacetedFilter
            column={table.getColumn('actionType')}
            title="Action Type"
            options={actionTypes}
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
      <DataTableViewOptions table={table} />
    </div>
  );
}
