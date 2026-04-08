'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { FirestoreReturn } from '@/lib/types';
import { toDate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  CreditCard,
} from 'lucide-react';

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
  shipped: 'secondary',
  received: 'secondary',
  processed: 'default',
};

export default function AdminReturnsPage() {
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

  const returnsQuery = useMemoFirebase(
    () => query(collection(firestore, 'returns'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: returns, isLoading } = useCollection<FirestoreReturn>(returnsQuery);

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

  const openConfirm = (
    title: string,
    description: string,
    actionLabel: string,
    variant: 'default' | 'destructive',
    onConfirm: () => Promise<void>
  ) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      actionLabel,
      variant,
      onConfirm: async () => {
        setIsActing(true);
        try {
          await onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Action failed. Please try again.' });
        } finally {
          setIsActing(false);
        }
      },
    });
  };

  const handleApprove = (ret: FirestoreReturn) => {
    openConfirm(
      'Approve Return',
      `Approve ${ret.type} request for order #${ret.orderNumber}?`,
      'Approve',
      'default',
      async () => {
        await updateDoc(doc(firestore, 'returns', ret.id), { status: 'approved', updatedAt: serverTimestamp() });
        await logAction('return_approved', `Approved ${ret.type} for order #${ret.orderNumber}`, ret.id);
        toast({ title: 'Return Approved', description: `${ret.type === 'return' ? 'Return' : 'Exchange'} for order #${ret.orderNumber} approved.` });
      }
    );
  };

  const handleReject = (ret: FirestoreReturn) => {
    openConfirm(
      'Reject Return',
      `Reject ${ret.type} request for order #${ret.orderNumber}?`,
      'Reject',
      'destructive',
      async () => {
        await updateDoc(doc(firestore, 'returns', ret.id), { status: 'rejected', updatedAt: serverTimestamp() });
        await logAction('return_rejected', `Rejected ${ret.type} for order #${ret.orderNumber}`, ret.id);
        toast({ title: 'Return Rejected', description: `${ret.type === 'return' ? 'Return' : 'Exchange'} for order #${ret.orderNumber} rejected.` });
      }
    );
  };

  const handleMarkShipped = (ret: FirestoreReturn) => {
    openConfirm(
      'Mark as Shipped',
      `Mark return items for order #${ret.orderNumber} as shipped back?`,
      'Mark Shipped',
      'default',
      async () => {
        await updateDoc(doc(firestore, 'returns', ret.id), { status: 'shipping', updatedAt: serverTimestamp() });
        await logAction('return_shipped', `Marked ${ret.type} as shipped for order #${ret.orderNumber}`, ret.id);
        toast({ title: 'Marked as Shipped', description: `Return items for order #${ret.orderNumber} marked as shipped.` });
      }
    );
  };

  const handleMarkReceived = (ret: FirestoreReturn) => {
    openConfirm(
      'Mark as Received',
      `Confirm that return items for order #${ret.orderNumber} have been received?`,
      'Mark Received',
      'default',
      async () => {
        await updateDoc(doc(firestore, 'returns', ret.id), { status: 'received', updatedAt: serverTimestamp() });
        await logAction('return_received', `Marked ${ret.type} as received for order #${ret.orderNumber}`, ret.id);
        toast({ title: 'Marked as Received', description: `Return items for order #${ret.orderNumber} marked as received.` });
      }
    );
  };

  const handleProcessRefund = (ret: FirestoreReturn) => {
    const totalAmount = ret.items.reduce((sum, item) => sum + item.price, 0);
    openConfirm(
      `Process ${ret.type === 'return' ? 'Refund' : 'Exchange'}`,
      `Process ${ret.type === 'return' ? 'refund of ' + currencyFormatter.format(totalAmount) : 'exchange'} for order #${ret.orderNumber}?`,
      ret.type === 'return' ? 'Process Refund' : 'Process Exchange',
      'default',
      async () => {
        await updateDoc(doc(firestore, 'returns', ret.id), { status: 'processed', updatedAt: serverTimestamp() });
        if (ret.type === 'return') {
          await updateDoc(doc(firestore, 'orders', ret.orderId), { status: 'refunded' });
        }
        await logAction('return_processed', `Processed ${ret.type} for order #${ret.orderNumber}`, ret.id);
        toast({ title: `${ret.type === 'return' ? 'Refund' : 'Exchange'} Processed`, description: `${ret.type === 'return' ? 'Refund' : 'Exchange'} for order #${ret.orderNumber} has been processed.` });
      }
    );
  };

  const columns: ColumnDef<FirestoreReturn>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => (
        <span className="font-medium">#{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: 'buyerName',
      header: 'Buyer',
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.type === 'return' ? 'outline' : 'secondary'}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.original.reason}</span>
      ),
    },
    {
      id: 'itemsCount',
      header: 'Items',
      cell: ({ row }) => row.original.items?.length || 0,
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
        const ret = row.original;
        const hasActions =
          ret.status === 'requested' ||
          ret.status === 'approved' ||
          ret.status === 'shipping' ||
          ret.status === 'received';

        if (!hasActions) return null;

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
              {ret.status === 'requested' && (
                <>
                  <DropdownMenuItem onClick={() => handleApprove(ret)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReject(ret)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
              {ret.status === 'approved' && (
                <DropdownMenuItem onClick={() => handleMarkShipped(ret)}>
                  <Truck className="mr-2 h-4 w-4" />
                  Mark as Shipped
                </DropdownMenuItem>
              )}
              {ret.status === 'shipping' && (
                <DropdownMenuItem onClick={() => handleMarkReceived(ret)}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Mark as Received
                </DropdownMenuItem>
              )}
              {ret.status === 'received' && (
                <DropdownMenuItem onClick={() => handleProcessRefund(ret)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {ret.type === 'return' ? 'Process Refund' : 'Process Exchange'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: returns || [],
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
          <h1 className="text-2xl font-bold tracking-tight">Returns & Exchanges</h1>
          <p className="text-muted-foreground">
            Manage return and exchange requests from buyers.
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
                  No return requests found.
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
