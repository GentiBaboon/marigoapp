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

const statuses = [
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
];

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by name..."
          value={(table.getColumn('displayName')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('displayName')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('courierStatus') && (
          <DataTableFacetedFilter
            column={table.getColumn('courierStatus')}
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
      <DataTableViewOptions table={table} />
    </div>
  );
}
