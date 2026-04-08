'use client';

import { useState } from 'react';
import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2, Download } from 'lucide-react';
import { DataTableViewOptions } from '@/components/admin/users/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/admin/users/data-table-faceted-filter';
import { brands } from '@/lib/mock-data';
import { writeBatch, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { exportToCSV } from '@/lib/csv-export';
import { useToast } from '@/hooks/use-toast';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const statuses = [
    { label: 'Active', value: 'active' },
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Sold', value: 'sold' },
    { label: 'Reserved', value: 'reserved' },
    { label: 'Rejected', value: 'rejected' },
];

const brandOptions = brands.map(brand => ({
    label: brand.name,
    value: brand.name
}));


export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      selectedRows.forEach((row) => {
        const product = row.original as any;
        if (product.id) {
          batch.delete(doc(firestore, 'products', product.id));
        }
      });
      await batch.commit();
      table.toggleAllRowsSelected(false);
      toast({ title: `${selectedRows.length} product(s) deleted.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error deleting products.' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleExportCSV = () => {
    const rows = (hasSelection ? selectedRows : table.getFilteredRowModel().rows).map(r => r.original as any);
    exportToCSV(rows, [
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status' },
      { key: 'price', header: 'Price' },
      { key: 'condition', header: 'Condition' },
      { key: 'views', header: 'Views' },
    ], `products-export-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by product title..."
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
        {table.getColumn('brand') && (
          <DataTableFacetedFilter
            column={table.getColumn('brand')}
            title="Brand"
            options={brandOptions}
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
        {hasSelection && (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedRows.length})
            </Button>
            <ConfirmActionDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              title="Delete Products"
              description={`Are you sure you want to delete ${selectedRows.length} product(s)? This action cannot be undone.`}
              onConfirm={handleBulkDelete}
              isLoading={isDeleting}
            />
          </>
        )}
        <Button variant="outline" size="sm" className="h-8" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
