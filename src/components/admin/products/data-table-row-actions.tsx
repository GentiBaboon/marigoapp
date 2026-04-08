'use client';

import * as React from 'react';
import { Row } from '@tanstack/react-table';
import Link from 'next/link';
import { MoreHorizontal, Eye, Star, Trash2, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestoreProduct } from '@/lib/types';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

const PRODUCT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'sold', label: 'Sold' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const product = row.original as FirestoreProduct;

  const logAction = async (actionType: string, details: string) => {
    if (!adminUser) return;
    await addDoc(collection(firestore, 'admin_logs'), {
      adminId: adminUser.uid,
      adminName: adminUser.displayName || 'Admin',
      actionType,
      details,
      targetId: product.id,
      timestamp: serverTimestamp(),
    });
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(firestore, 'products', product.id), { status: newStatus });
      await logAction('product_status_changed', `Changed "${product.title}" status to "${newStatus}"`);
      toast({ title: 'Status Updated', description: `"${product.title}" is now "${newStatus}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update product status.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFeatured = async () => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      const newFeatured = !product.isFeatured;
      await updateDoc(doc(firestore, 'products', product.id), { isFeatured: newFeatured });
      await logAction('product_featured', `${newFeatured ? 'Featured' : 'Unfeatured'} "${product.title}"`);
      toast({ title: newFeatured ? 'Product Featured' : 'Product Unfeatured' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update product.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(firestore, 'products', product.id));
      await logAction('product_deleted', `Deleted product "${product.title}"`);
      toast({ title: 'Product Deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete product.' });
    } finally {
      setIsLoading(false);
    }
  };

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
        <DropdownMenuItem asChild>
          <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="mr-2 h-4 w-4" />
            View on Site
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/products/${product.id}`}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Review Product
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Change Status
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>
                   {PRODUCT_STATUSES.map((status) => (
                     <DropdownMenuItem
                       key={status.value}
                       disabled={product.status === status.value}
                       onClick={() => handleChangeStatus(status.value)}
                     >
                       {status.label}
                     </DropdownMenuItem>
                   ))}
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={handleToggleFeatured}>
            <Star className={`mr-2 h-4 w-4 ${product.isFeatured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {product.isFeatured ? 'Unfeature' : 'Feature'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmActionDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Delete Product"
      description={`Are you sure you want to permanently delete "${product.title}"? This action cannot be undone.`}
      actionLabel="Delete"
      variant="destructive"
      onConfirm={handleDelete}
      isLoading={isLoading}
    />
    </>
  );
}
