'use client';
import * as React from 'react';
import { Row } from '@tanstack/react-table';
import { MoreHorizontal, Loader2, Check, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { CourierData } from '@/app/admin/logistics/page';


interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const courier = row.original as CourierData;

  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    if (!firestore || !adminUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not perform action.'});
        return;
    }
    setIsLoading(true);

    const targetUserRef = doc(firestore, 'users', courier.id);
    const logCollectionRef = collection(firestore, 'admin_logs');

    try {
        await updateDoc(targetUserRef, { courierStatus: newStatus });

        await addDoc(logCollectionRef, {
            adminId: adminUser.uid,
            adminName: adminUser.displayName || 'Admin',
            actionType: newStatus === 'approved' ? 'courier_approved' : 'courier_rejected',
            details: `${newStatus === 'approved' ? 'Approved' : 'Rejected'} courier application for "${courier.displayName}" (ID: ${courier.id})`,
            targetId: courier.id,
            timestamp: serverTimestamp()
        });

        toast({ title: `Courier ${newStatus}`, description: `${courier.displayName}'s application has been ${newStatus}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update courier status.' });
    } finally {
        setIsLoading(false);
    }
  };

  const isPending = courier.courierStatus === 'pending_approval';

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
        {isPending && (
            <>
                <DropdownMenuItem onClick={() => handleUpdateStatus('approved')}>
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => handleUpdateStatus('rejected')}>
                    <X className="mr-2 h-4 w-4" />
                    Reject
                </DropdownMenuItem>
            </>
        )}
         <DropdownMenuSeparator />
        <DropdownMenuItem>
            <ShieldAlert className="mr-2 h-4 w-4" />
            View Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
