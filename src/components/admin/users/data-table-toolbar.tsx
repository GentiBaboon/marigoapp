'use client';

import { useState } from 'react';
import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2, Ban, Download } from 'lucide-react';
import { DataTableViewOptions } from './data-table-view-options';
import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { writeBatch, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { exportToCSV } from '@/lib/csv-export';
import { useToast } from '@/hooks/use-toast';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const roles = [
    { label: 'Admin', value: 'Admin' },
    { label: 'Seller', value: 'Seller' },
    { label: 'Customer', value: 'Customer' },
];

const statuses = [
    { label: 'Active', value: 'active' },
    { label: 'Banned', value: 'banned' }
]

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [isBanning, setIsBanning] = useState(false);

  const handleBulkBan = async () => {
    setIsBanning(true);
    try {
      const batch = writeBatch(firestore);
      selectedRows.forEach((row) => {
        const user = row.original as any;
        if (user.id) {
          batch.update(doc(firestore, 'users', user.id), { status: 'banned' });
        }
      });
      await batch.commit();
      table.toggleAllRowsSelected(false);
      toast({ title: `${selectedRows.length} user(s) banned.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error banning users.' });
    } finally {
      setIsBanning(false);
      setBanDialogOpen(false);
    }
  };

  const handleExportCSV = () => {
    const rows = (hasSelection ? selectedRows : table.getFilteredRowModel().rows).map(r => r.original as any);
    exportToCSV(rows, [
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role' },
      { key: 'status', header: 'Status' },
      { key: 'rating', header: 'Rating' },
    ], `users-export-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by name or email..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('name')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('role') && (
          <DataTableFacetedFilter
            column={table.getColumn('role')}
            title="Role"
            options={roles}
          />
        )}
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
        {hasSelection && (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => setBanDialogOpen(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Ban ({selectedRows.length})
            </Button>
            <ConfirmActionDialog
              open={banDialogOpen}
              onOpenChange={setBanDialogOpen}
              title="Ban Users"
              description={`Are you sure you want to ban ${selectedRows.length} user(s)? They will lose access to the marketplace.`}
              onConfirm={handleBulkBan}
              isLoading={isBanning}
              variant="destructive"
              actionLabel="Ban Users"
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
