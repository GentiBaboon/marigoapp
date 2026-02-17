'use client';

import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2 } from 'lucide-react';
import { DataTableViewOptions } from '@/components/admin/users/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/admin/users/data-table-faceted-filter';
import { productCategories } from '@/lib/mock-data';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const statuses = [
    { label: 'Active', value: 'active' },
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Sold', value: 'sold' },
    { label: 'Reserved', value: 'reserved' },
];

const categories = productCategories.flatMap(cat => 
    cat.subcategories.map(sub => ({
        label: sub.name,
        value: sub.slug
    }))
);


export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const isRowsSelected = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by title..."
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('title')?.setFilterValue(event.target.value)
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
        {table.getColumn('category') && (
          <DataTableFacetedFilter
            column={table.getColumn('category')}
            title="Category"
            options={categories}
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
