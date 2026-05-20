'use client';
import * as React from 'react';
import { Row } from '@tanstack/react-table';
import { MoreHorizontal, Ban, Trash2, ShieldCheck, View, CircleSlash, Loader2, BadgeCheck } from 'lucide-react';
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
import { FirestoreUser, type SellerBadgeLevel, getSellerLevel } from '@/lib/types';
import { useBadgeSettings } from '@/hooks/use-badge-settings';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';

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
  const [confirmBanOpen, setConfirmBanOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const targetUser = row.original as FirestoreUser;
  const { data: badgeSettings } = useBadgeSettings();
  const badgeLabels = {
    trusted: badgeSettings?.labels?.trusted ?? 'Trusted Seller',
    expert: badgeSettings?.labels?.expert ?? 'Expert Seller',
    activist: badgeSettings?.labels?.activist ?? 'Fashion Activist',
    official: badgeSettings?.labels?.official ?? 'Official Registered Brand',
  };

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
            details: `${newStatus === 'banned' ? 'Banned' : 'Unbanned'} user "${displayName}" (ID: ${targetUser.id})`,
            targetId: targetUser.id,
            timestamp: serverTimestamp()
        });

        toast({ title: `User ${newStatus}`, description: `${displayName} has been ${newStatus}.` });
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
        details: `Changed role of "${displayName}" to "${newRole}"`,
        targetId: targetUser.id,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'Role Updated', description: `${displayName} is now "${newRole}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to change role.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Admin sets the user's badge directly. `'auto'` clears the override so the
  // badge is recomputed from salesCount + thresholds. Setting `official` also
  // flips `isOfficialBrand` so existing read paths (multi-variant gating,
  // seller card on PDP) keep working without changes.
  const handleSetBadge = async (next: SellerBadgeLevel | 'auto') => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      const update: Record<string, any> = {
        badgeOverride: next === 'auto' ? null : next,
        isOfficialBrand: next === 'official' ? true : next === 'auto' ? !!targetUser.isOfficialBrand : false,
      };
      await updateDoc(doc(firestore, 'users', targetUser.id), update);
      await addDoc(collection(firestore, 'admin_logs'), {
        adminId: adminUser.uid,
        adminName: adminUser.displayName || 'Admin',
        actionType: 'user_badge_changed',
        details: `Set badge of "${displayName}" to "${next}"`,
        targetId: targetUser.id,
        timestamp: serverTimestamp(),
      });
      toast({
        title: 'Badge updated',
        description: next === 'auto'
          ? `${displayName} now uses the auto-computed badge.`
          : `${displayName} is now "${next}".`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update badge.' });
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
        details: `Soft-deleted user "${displayName}" (ID: ${targetUser.id})`,
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
  const displayName = targetUser.name || targetUser.email || 'this user';

  return (
    <>
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
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Set Badge
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={targetUser.badgeOverride ?? 'auto'}
                      onValueChange={(v) => handleSetBadge(v as any)}
                    >
                        <DropdownMenuRadioItem value="auto">Auto (from sales)</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="trusted">{badgeLabels.trusted}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="expert">{badgeLabels.expert}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="activist">{badgeLabels.activist}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="official">{badgeLabels.official}</DropdownMenuRadioItem>
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
            <DropdownMenuItem onClick={() => setConfirmBanOpen(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Ban User
            </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmActionDialog
      open={confirmBanOpen}
      onOpenChange={setConfirmBanOpen}
      title="Ban User"
      description={`Are you sure you want to ban "${displayName}"? They will lose access to their account.`}
      actionLabel="Ban User"
      variant="destructive"
      onConfirm={() => handleUpdateStatus('banned')}
      isLoading={isLoading}
    />
    <ConfirmActionDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Delete User"
      description={`Are you sure you want to remove "${displayName}"? This will ban their account.`}
      actionLabel="Delete"
      variant="destructive"
      onConfirm={handleDelete}
      isLoading={isLoading}
    />
    </>
  );
}
