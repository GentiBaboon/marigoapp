'use client';

import * as React from 'react';
import { Row } from '@tanstack/react-table';
import { MoreHorizontal, View, Truck, Undo, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestoreOrder } from '@/lib/types';

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

const ORDER_STATUSES = [
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
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
      await updateDoc(doc(firestore, 'orders', order.id), { status: newStatus });
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
        <DropdownMenuItem>
          <View className="mr-2 h-4 w-4" />
          View Details
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
