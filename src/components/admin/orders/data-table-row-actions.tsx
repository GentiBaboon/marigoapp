'use client';

import * as React from 'react';
import { notifyAdmin } from '@/lib/admin-notify';
import { Row } from '@tanstack/react-table';
import Link from 'next/link';
import { MoreHorizontal, View, Truck, Undo, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, collection, addDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestoreOrder } from '@/lib/types';
import { notifyOrderStatus } from '@/lib/notifications';
import { releaseOrderItems, markOrderItemsSoldIfDepleted } from '@/lib/order-inventory';

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

// Statuses match the canonical flow defined in lib/order-status.ts. Note the
// dropdown shows `Processing` for value `confirmed` — this is the stage
// label admins use, even though the underlying status is `confirmed`.
const ORDER_STATUSES = [
  { value: 'confirmed', label: 'Processing' },
  { value: 'in_preparation', label: 'In Preparation' },
  { value: 'prepared', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
] as const;

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const order = row.original as FirestoreOrder;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: newStatus,
          at: new Date().toISOString(),
          by: adminUser.uid,
        }),
      });

      // Quantity-aware inventory sync (see lib/order-inventory).
      const wasTerminal = order.status === 'cancelled' || order.status === 'refunded';
      if ((newStatus === 'cancelled' || newStatus === 'refunded') && !wasTerminal) {
        await releaseOrderItems(firestore, order.items as any);
        // Same alert as the order detail screen — an order can be cancelled
        // from either surface, so both have to raise it.
        if (newStatus === 'cancelled') {
          void notifyAdmin(adminUser, {
            event: 'order_cancelled',
            orderId: order.id,
            previousStatus: order.status,
          });
        }
      } else if (newStatus === 'completed' && order.status !== 'completed') {
        await markOrderItemsSoldIfDepleted(firestore, order.items as any);
      }

      // Notify buyer + every seller so the status change shows up in the bell
      // immediately, regardless of which admin surface triggered it.
      const firstItem = order.items?.[0];
      const productTitle = firstItem?.title;
      const productImage = firstItem?.image;
      if (order.buyerId) {
        notifyOrderStatus({
          firestore,
          userId: order.buyerId,
          orderNumber: order.orderNumber,
          status: newStatus,
          link: `/profile/orders/${order.id}`,
          audience: 'buyer',
          productTitle,
          productImage,
        }).catch(() => null);
      }
      Array.from(new Set(order.sellerIds || [])).forEach((sellerId) => {
        if (!sellerId) return;
        notifyOrderStatus({
          firestore,
          userId: sellerId,
          orderNumber: order.orderNumber,
          status: newStatus,
          link: `/profile/listings/sales/${order.id}`,
          audience: 'seller',
          productTitle,
          productImage,
        }).catch(() => null);
      });

      await addDoc(collection(firestore, 'admin_logs'), {
        adminId: adminUser.uid,
        adminName: adminUser.displayName || 'Admin',
        actionType: 'order_status_updated',
        details: `Updated order #${order.orderNumber} status to "${newStatus}"`,
        targetId: order.id,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'Status Updated', description: `Order #${order.orderNumber} is now "${newStatus}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/admin/orders/${order.id}`}>
            <View className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
            <Truck className="mr-2 h-4 w-4" />
            Add Tracking
        </DropdownMenuItem>
         <DropdownMenuItem>
            <MessageSquare className="mr-2 h-4 w-4" />
            Message Buyer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Update Status
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>
                   {ORDER_STATUSES.map((status) => (
                     <DropdownMenuItem
                       key={status.value}
                       disabled={order.status === status.value}
                       onClick={() => handleUpdateStatus(status.value)}
                     >
                       {status.label}
                     </DropdownMenuItem>
                   ))}
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => handleUpdateStatus('refunded')}
        >
          <Undo className="mr-2 h-4 w-4" />
          Refund/Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
