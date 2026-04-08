'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { FirestoreRefund } from '@/lib/types';
import { toDate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, MoreHorizontal, CheckCircle, XCircle, CreditCard } from 'lucide-react';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'outline',
  approved: 'default',
  rejected: 'destructive',
  processed: 'secondary',
};

export default function AdminRefundsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', actionLabel: 'Confirm', variant: 'default', onConfirm: () => {} });
  const [isActing, setIsActing] = React.useState(false);

  const refundsQuery = useMemoFirebase(
    () => query(collection(firestore, 'refunds'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: refunds, isLoading } = useCollection<FirestoreRefund>(refundsQuery);

  const logAction = async (actionType: string, details: string, targetId: string) => {
    await addDoc(collection(firestore, 'admin_logs'), {
      adminId: user?.uid || '',
      adminName: user?.displayName || user?.email || 'Admin',
      actionType,
      details,
      targetId,
      timestamp: serverTimestamp(),
    });
  };

  const handleApprove = (refund: FirestoreRefund) => {
    setConfirmDialog({
      open: true,
      title: 'Approve Refund',
      description: `Approve refund of ${currencyFormatter.format(refund.amount)} for order #${refund.orderNumber}? This will also update the order status to refunded.`,
      actionLabel: 'Approve',
      variant: 'default',
      onConfirm: async () => {
        setIsActing(true);
        try {
          await updateDoc(doc(firestore, 'refunds', refund.id), {
            status: 'approved',
            updatedAt: serverTimestamp(),
          });
          await updateDoc(doc(firestore, 'orders', refund.orderId), {
            status: 'refunded',
          });
          await logAction('refund_approved', `Approved refund of ${currencyFormatter.format(refund.amount)} for order #${refund.orderNumber}`, refund.id);
          toast({ title: 'Refund Approved', description: `Refund for order #${refund.orderNumber} has been approved.` });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve refund.' });
        } finally {
          setIsActing(false);
        }
      },
    });
  };

  const handleReject = (refund: FirestoreRefund) => {
    setConfirmDialog({
      open: true,
      title: 'Reject Refund',
      description: `Reject refund request of ${currencyFormatter.format(refund.amount)} for order #${refund.orderNumber}?`,
      actionLabel: 'Reject',
      variant: 'destructive',
      onConfirm: async () => {
        setIsActing(true);
        try {
          await updateDoc(doc(firestore, 'refunds', refund.id), {
            status: 'rejected',
            updatedAt: serverTimestamp(),
          });
          await logAction('refund_rejected', `Rejected refund of ${currencyFormatter.format(refund.amount)} for order #${refund.orderNumber}`, refund.id);
          toast({ title: 'Refund Rejected', description: `Refund for order #${refund.orderNumber} has been rejected.` });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to reject refund.' });
        } finally {
          setIsActing(false);
        }
      },
    });
  };

  const handleMarkProcessed = (refund: FirestoreRefund) => {
    setConfirmDialog({
      open: true,
      title: 'Mark as Processed',
      description: `Mark refund of ${currencyFormatter.format(refund.amount)} for order #${refund.orderNumber} as processed?`,
      actionLabel: 'Mark Processed',
      variant: 'default',
      onConfirm: async () => {
        setIsActing(true);
        try {
          await updateDoc(doc(firestore, 'refunds', refund.id), {
            status: 'processed',
            updatedAt: serverTimestamp(),
          });
          await logAction('refund_processed', `Marked refund as processed for order #${refund.orderNumber}`, refund.id);
          toast({ title: 'Refund Processed', description: `Refund for order #${refund.orderNumber} has been marked as processed.` });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark refund as processed.' });
        } finally {
          setIsActing(false);
        }
      },
    });
  };

  const columns: ColumnDef<FirestoreRefund>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => (
        <span className="font-medium">#{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: 'requesterName',
      header: 'Requester',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => currencyFormatter.format(row.original.amount),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] || 'outline'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => {
        const date = toDate(row.original.createdAt);
        return date ? format(date, 'd MMM yyyy') : '-';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const refund = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {refund.status === 'pending' && (
                <>
                  <DropdownMenuItem onClick={() => handleApprove(refund)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReject(refund)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
              {refund.status === 'approved' && (
                <DropdownMenuItem onClick={() => handleMarkProcessed(refund)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Mark Processed
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: refunds || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Review and manage refund requests from customers.
          </p>
        </div>
      </div>

      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by order number..."
          value={(table.getColumn('orderNumber')?.getFilterValue() as string) ?? ''}
          onChange={(e) => table.getColumn('orderNumber')?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No refund requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionLabel={confirmDialog.actionLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActing}
      />
    </div>
  );
}
