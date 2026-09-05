'use client';

import * as React from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { collection, query, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { FirestoreReturn } from '@/lib/types';
import { notifyOrderStatus } from '@/lib/notifications';
import { releaseOrderItems } from '@/lib/order-inventory';
import { recordRefundForReturn, loadOrder } from '@/lib/order-lifecycle';
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


const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'outline',
  approved: 'default',
  ready_for_pickup: 'outline',
  shipping: 'secondary',
  shipped: 'secondary',
  received: 'secondary',
  refunded: 'default',
  processed: 'default',
  rejected: 'destructive',
};

// Display labels that mirror the buyer-facing return-timeline copy so admin
// and buyer/seller see the same wording.
const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  approved: 'Return Initiated',
  ready_for_pickup: 'Return Package Ready',
  shipping: 'Return Package Shipped',
  shipped: 'Return Package Shipped',
  received: 'Return Package Delivered',
  refunded: 'Refunded',
  processed: 'Refunded',
  rejected: 'Rejected',
};

export default function AdminReturnsPage() {
  const { formatPrice } = useCurrency();
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
      `Process ${ret.type === 'return' ? 'refund of ' + formatPrice(totalAmount) : 'exchange'} for order #${ret.orderNumber}?`,
      ret.type === 'return' ? 'Process Refund' : 'Process Exchange',
      'default',
      async () => {
        // ── Shopify-style lifecycle: create the Refund + ledger row, link
        //    everything together, then flip the order status. The helper sets
        //    return.status = 'refunded' for us, so we don't need to touch it
        //    here (no double-write to 'processed').
        if (ret.type === 'return') {
          // ── Source of truth: the order's `status` field. We flip it to
          //    `refunded` FIRST so the order shows up correctly in finance and
          //    refunds tables regardless of what happens to the side-collection
          //    writes that follow. Without this ordering, a silent failure on
          //    the refund/transaction write would leave the order looking
          //    un-refunded — which is what was happening before.
          await updateDoc(doc(firestore, 'orders', ret.orderId), {
            status: 'refunded',
            updatedAt: serverTimestamp(),
            statusHistory: arrayUnion({
              status: 'refunded',
              at: new Date().toISOString(),
              by: user?.uid || 'admin',
            }),
          });

          // Best-effort refund + transaction docs. These are useful metadata
          // (reason, processed-by, ledger entries) but their absence must NOT
          // make the order look un-refunded in admin views.
          const order = await loadOrder(firestore, ret.orderId);
          if (order) {
            try {
              const { refundId, transactionId } = await recordRefundForReturn({
                firestore,
                order,
                returnDoc: ret,
                processedBy: user?.uid,
                processedByName: user?.displayName || 'Admin',
              });
              console.log('[returns] refund metadata created', { refundId, transactionId });
            } catch (e: any) {
              // Don't block the workflow — the order is already correctly
              // marked refunded. Just warn so we can see the cause.
              console.warn('[returns] refund/transaction docs not created (order is still refunded):', e);
              toast({
                variant: 'destructive',
                title: 'Refund recorded but metadata write failed',
                description: e?.message || 'Order is marked refunded; the refund/transaction docs were not written. Check console.',
              });
            }
          }

          // Restore stock and re-list returned items.
          await releaseOrderItems(firestore, ret.items as any);

          const firstItem = ret.items?.[0];
          notifyOrderStatus({
            firestore,
            userId: ret.buyerId,
            orderNumber: ret.orderNumber,
            status: 'refunded',
            link: `/profile/orders/${ret.orderId}`,
            audience: 'buyer',
            productTitle: firstItem?.title,
            productImage: firstItem?.image,
          }).catch(() => null);
          if (ret.sellerId) {
            notifyOrderStatus({
              firestore,
              userId: ret.sellerId,
              orderNumber: ret.orderNumber,
              status: 'refunded',
              link: `/profile/listings/sales/${ret.orderId}`,
              audience: 'seller',
              productTitle: firstItem?.title,
              productImage: firstItem?.image,
            }).catch(() => null);
          }
        } else {
          // Exchange path: keep the legacy behavior of flipping the return to
          // 'exchanged' so admin filters still work. No refund is issued.
          await updateDoc(doc(firestore, 'returns', ret.id), {
            status: 'exchanged',
            updatedAt: serverTimestamp(),
          });
        }
        await logAction('return_processed', `Processed ${ret.type} for order #${ret.orderNumber}`, ret.id);
        toast({ title: `${ret.type === 'return' ? 'Refund' : 'Exchange'} Processed`, description: `${ret.type === 'return' ? 'Refund' : 'Exchange'} for order #${ret.orderNumber} has been processed.` });
      }
    );
  };

  // Re-runs the refund-creation step for a return that already shows as
  // `refunded` but is missing a refund + transaction row. Happens when the
  // original Process Refund click pre-dated the lifecycle wiring (or hit a
  // silent failure). Idempotent on the order side: the helper just appends
  // another refund + transaction; double-runs are safe to recognize manually.
  const handleBackfillRefund = (ret: FirestoreReturn) => {
    const totalAmount = ret.items.reduce((sum, item) => sum + item.price, 0);
    openConfirm(
      'Backfill refund record',
      `Create the missing refund + finance entries for order #${ret.orderNumber} (${formatPrice(totalAmount)})? Use this when /admin/refunds and /admin/finance don't reflect a refund that was already processed.`,
      'Backfill',
      'default',
      async () => {
        try {
          const order = await loadOrder(firestore, ret.orderId);
          if (!order) {
            toast({ variant: 'destructive', title: 'Order not found', description: `Order ${ret.orderId} couldn't be loaded.` });
            return;
          }
          const { refundId, transactionId } = await recordRefundForReturn({
            firestore,
            order,
            returnDoc: ret,
            processedBy: user?.uid,
            processedByName: user?.displayName || 'Admin',
          });
          await logAction('refund_backfilled', `Backfilled refund record for order #${ret.orderNumber}`, ret.id);
          toast({
            title: 'Refund record created',
            description: `Refund ${refundId.slice(0, 8)}… and transaction ${transactionId.slice(0, 8)}… are now written.`,
          });
        } catch (e: any) {
          console.error('[returns] backfill failed', e);
          toast({
            variant: 'destructive',
            title: 'Backfill failed',
            description: e?.message || 'See console for details.',
          });
        }
      },
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
          {STATUS_LABEL[row.original.status] || row.original.status}
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
        // `needsBackfill` covers returns that were processed before the
        // refund/transaction lifecycle wiring was deployed (or in any case
        // where the refund row is missing). Surfacing the action here lets
        // admin retroactively create the missing finance + refund records
        // without re-running the full flow.
        const needsBackfill = ret.status === 'refunded' && !ret.refundId;
        const hasActions =
          ret.status === 'requested' ||
          ret.status === 'approved' ||
          ret.status === 'ready_for_pickup' ||
          ret.status === 'shipping' ||
          ret.status === 'received' ||
          needsBackfill;

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
              {(ret.status === 'approved' || ret.status === 'ready_for_pickup') && (
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
              {needsBackfill && (
                <DropdownMenuItem onClick={() => handleBackfillRefund(ret)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Backfill refund record
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
