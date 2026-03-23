'use client';
import * as React from 'react';
import { Row } from '@tanstack/react-table';
import { MoreHorizontal, Ban, Trash2, ShieldCheck, View, CircleSlash, Loader2 } from 'lucide-react';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestoreUser } from '@/lib/types';

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
  const targetUser = row.original as FirestoreUser;

  const handleUpdateStatus = async (newStatus: 'active' | 'banned') => {
    if (!firestore || !adminUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not perform action.'});
        return;
    }
    setIsLoading(true);

    const targetUserRef = doc(firestore, 'users', targetUser.id);
    const logCollectionRef = collection(firestore, 'admin_logs');

    try {
        await updateDoc(targetUserRef, { status: newStatus });

        await addDoc(logCollectionRef, {
            adminId: adminUser.uid,
            adminName: adminUser.displayName || 'Admin',
            actionType: newStatus === 'banned' ? 'user_banned' : 'user_unbanned',
            details: `${newStatus === 'banned' ? 'Banned' : 'Unbanned'} user "${targetUser.name}" (ID: ${targetUser.id})`,
            targetId: targetUser.id,
            timestamp: serverTimestamp()
        });

        toast({ title: `User ${newStatus}`, description: `${targetUser.name} has been ${newStatus}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update user status.' });
    } finally {
        setIsLoading(false);
    }
  };


  const handleChangeRole = async (newRole: string) => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(firestore, 'users', targetUser.id), {
        role: newRole,
        isSeller: newRole === 'seller' || newRole === 'admin',
      });
      await addDoc(collection(firestore, 'admin_logs'), {
        adminId: adminUser.uid,
        adminName: adminUser.displayName || 'Admin',
        actionType: 'user_role_changed',
        details: `Changed role of "${targetUser.name}" to "${newRole}"`,
        targetId: targetUser.id,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'Role Updated', description: `${targetUser.name} is now "${newRole}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to change role.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(firestore, 'users', targetUser.id), { status: 'banned' });
      await addDoc(collection(firestore, 'admin_logs'), {
        adminId: adminUser.uid,
        adminName: adminUser.displayName || 'Admin',
        actionType: 'user_deleted',
        details: `Soft-deleted user "${targetUser.name}" (ID: ${targetUser.id})`,
        targetId: targetUser.id,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'User Removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete user.' });
    } finally {
      setIsLoading(false);
    }
  };

  const isBanned = targetUser.status === 'banned';

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
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Change Role
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={targetUser.role}
                      onValueChange={handleChangeRole}
                    >
                        <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="seller">Seller</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="buyer">Buyer</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="courier">Courier</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {isBanned ? (
            <DropdownMenuItem onClick={() => handleUpdateStatus('active')}>
                <CircleSlash className="mr-2 h-4 w-4" />
                Unban User
            </DropdownMenuItem>
        ) : (
            <DropdownMenuItem onClick={() => handleUpdateStatus('banned')}>
                <Ban className="mr-2 h-4 w-4" />
                Ban User
            </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
