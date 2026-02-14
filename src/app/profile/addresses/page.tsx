'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Home,
  MoreVertical,
  Plus,
  Trash2,
  Edit,
  Star,
} from 'lucide-react';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AddressForm } from '@/components/profile/address-form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

function AddressSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex-row justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-10 border-2 border-dashed rounded-lg">
      <Home className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No addresses found</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a new address to get started.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" /> Add Address
      </Button>
    </div>
  );
}

export default function AddressesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState<FirestoreAddress | null>(null);
  const [deletingAddressId, setDeletingAddressId] = React.useState<string | null>(null);
  const [isSettingDefault, setIsSettingDefault] = React.useState(false);

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);

  const { data: addresses, isLoading: areAddressesLoading } = useCollection<FirestoreAddress>(addressesCollection);

  const handleAdd = () => {
    setEditingAddress(null);
    setIsFormOpen(true);
  };

  const handleEdit = (address: FirestoreAddress) => {
    setEditingAddress(address);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAddressId || !addressesCollection) return;
    try {
      await deleteDoc(doc(addressesCollection, deletingAddressId));
      toast({ title: 'Address deleted successfully.' });
    } catch (error) {
      console.error('Error deleting address:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete address.',
      });
    } finally {
      setDeletingAddressId(null);
    }
  };
  
  const handleSetDefault = async (addressToSet: FirestoreAddress) => {
      if (!firestore || !user || !addresses || addressToSet.isDefault) return;
      setIsSettingDefault(true);
      const batch = writeBatch(firestore);
      
      const currentDefault = addresses.find(addr => addr.isDefault);
      if (currentDefault) {
          const currentDefaultRef = doc(firestore, 'users', user.uid, 'addresses', currentDefault.id);
          batch.update(currentDefaultRef, { isDefault: false });
      }

      const newDefaultRef = doc(firestore, 'users', user.uid, 'addresses', addressToSet.id);
      batch.update(newDefaultRef, { isDefault: true });

      try {
          await batch.commit();
          toast({ title: 'Default address updated.' });
      } catch (error) {
          console.error("Failed to set default address:", error);
          toast({ variant: 'destructive', title: "Error", description: "Could not update default address." });
      } finally {
          setIsSettingDefault(false);
      }
  }


  const isLoading = isUserLoading || areAddressesLoading;

  if (!user && !isUserLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>My Addresses</CardTitle>
            <CardDescription>
              Please sign in to manage your addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Addresses</h1>
            <p className="text-muted-foreground">Manage your shipping addresses.</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Address
          </Button>
        </div>

        {isLoading ? (
          <AddressSkeleton />
        ) : addresses && addresses.length > 0 ? (
          <div className="space-y-4">
            {addresses.map((address) => (
              <Card key={address.id} className={address.isDefault ? 'border-primary' : ''}>
                <CardHeader className="flex-row justify-between items-start p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{address.fullName}</p>
                        {address.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {address.address}, {address.city} {address.postal}, {address.country}
                    </p>
                    <p className="text-sm text-muted-foreground">{address.phone}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(address)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {!address.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(address)} disabled={isSettingDefault}>
                           <Star className="mr-2 h-4 w-4" /> Set as default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeletingAddressId(address.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState onAdd={handleAdd} />
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
          </DialogHeader>
          {addressesCollection && (
            <AddressForm
              userId={user.uid}
              addressToEdit={editingAddress}
              onSave={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deletingAddressId} onOpenChange={(open) => !open && setDeletingAddressId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this address.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
