'use client';

import { Table } from '@tanstack/react-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Newest / oldest ordering for an admin table.
 *
 * The date columns already sort by clicking their header, but a header that
 * happens to be clickable is not a control anyone finds — "show me the newest
 * first" is the single most common thing to want from a list of orders, users
 * or listings, so it gets a visible control that says so.
 *
 * Writes into the same `sorting` state the headers use, so the two stay in
 * agreement rather than fighting: sorting by another column simply leaves this
 * showing its placeholder.
 */
export function DataTableSort<TData>({
  table,
  column,
  newestLabel = 'Newest first',
  oldestLabel = 'Oldest first',
}: {
  table: Table<TData>;
  /** Column id holding the date to order by. */
  column: string;
  newestLabel?: string;
  oldestLabel?: string;
}) {
  if (!table.getColumn(column)) return null;

  const active = table.getState().sorting.find(s => s.id === column);
  const value = active ? (active.desc ? 'newest' : 'oldest') : '';

  return (
    <Select
      value={value}
      onValueChange={v => table.setSorting([{ id: column, desc: v === 'newest' }])}
    >
      <SelectTrigger className="h-8 w-[150px]" aria-label="Sort order">
        <SelectValue placeholder="Sort by date" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">{newestLabel}</SelectItem>
        <SelectItem value="oldest">{oldestLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
