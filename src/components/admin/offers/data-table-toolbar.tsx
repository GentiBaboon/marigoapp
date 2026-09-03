'use client';

import { Table } from '@tanstack/react-table';
import { Download, X } from 'lucide-react';
import { format } from 'date-fns';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTableViewOptions } from '@/components/admin/users/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/admin/users/data-table-faceted-filter';
import { DataTableSort } from '@/components/admin/data-table-sort';
import { exportToCSV } from '@/lib/csv-export';
import { toDate } from '@/lib/types';
import { currentAmount, OFFER_STATUSES, offerStatusLabel } from '@/lib/offers';
import type { AdminOfferRow } from './columns';

const statuses = OFFER_STATUSES.map((value) => ({
  value,
  label: offerStatusLabel(value, 'admin'),
}));

interface DataTableToolbarProps {
  table: Table<AdminOfferRow>;
}

export function DataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    exportToCSV(
      rows,
      [
        { key: 'id', header: 'Offer ID' },
        { key: 'productId', header: 'Product ID' },
        { key: 'productTitle', header: 'Listing' },
        { key: 'buyerName', header: 'Buyer' },
        { key: 'buyerEmail', header: 'Buyer email' },
        { key: 'sellerName', header: 'Seller' },
        { key: 'sellerEmail', header: 'Seller email' },
        {
          key: 'amount',
          header: 'Amount on table (EUR)',
          transform: (_v, row) => currentAmount({ ...row, status: row.effectiveStatus }).toFixed(2),
        },
        {
          key: 'listingPrice',
          header: 'Asking price (EUR)',
          transform: (v, row) => (v ?? row.originalListingPrice ?? '').toString(),
        },
        { key: 'effectiveStatus', header: 'Status' },
        { key: 'message', header: 'Message' },
        {
          key: 'createdAt',
          header: 'Created',
          transform: (v) => {
            const d = toDate(v);
            return d ? d.toISOString() : '';
          },
        },
      ],
      `offers-${format(new Date(), 'yyyy-MM-dd')}`,
    );
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by listing…"
          value={(table.getColumn('productTitle')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('productTitle')?.setFilterValue(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('effectiveStatus') && (
          <DataTableFacetedFilter column={table.getColumn('effectiveStatus')} title="Status" options={statuses} />
        )}
        <DataTableSort table={table} column="createdAt" />
        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
