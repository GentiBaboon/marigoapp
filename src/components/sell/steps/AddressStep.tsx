'use client';
import * as React from 'react';
import { useSellForm } from '@/components/sell/SellFormContext';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { collection } from 'firebase/firestore';

import { StepActions } from '../StepActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit } from 'lucide-react';
import { AddressForm } from '@/components/profile/address-form';
import { cn } from '@/lib/utils';

function AddressSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 rounded-md border p-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

export function AddressStep() {
    const { formData, setFormData, nextStep } = useSellForm();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [selectedAddressId, setSelectedAddressId] = React.useState<string | undefined>(formData.shippingFromAddressId);
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingAddress, setEditingAddress] = React.useState<FirestoreAddress | null>(null);

    const addressesCollection = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'addresses');
    }, [user, firestore]);

    const { data: addresses, isLoading: areAddressesLoading } = useCollection<FirestoreAddress>(addressesCollection);
    
    // Auto-select default address if none is selected
    React.useEffect(() => {
        if (!selectedAddressId && addresses) {
            const defaultAddress = addresses.find(a => a.isDefault);
            if (defaultAddress) {
                setSelectedAddressId(defaultAddress.id);
            } else if (addresses.length > 0) {
                setSelectedAddressId(addresses[0].id);
            }
        }
    }, [addresses, selectedAddressId]);


    const handleAdd = () => {
        setEditingAddress(null);
        setIsFormOpen(true);
    };

    const handleEdit = (address: FirestoreAddress) => {
        setEditingAddress(address);
        setIsFormOpen(true);
    };
    
    const handleContinue = () => {
        if (selectedAddressId) {
            setFormData({ shippingFromAddressId: selectedAddressId });
            nextStep();
        }
    }
    
    const isLoading = isUserLoading || areAddressesLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Address book</CardTitle>
                <CardDescription>Select the address you will be shipping from.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {isLoading ? (
                        <AddressSkeleton />
                    ) : (
                        <RadioGroup
                            value={selectedAddressId}
                            onValueChange={setSelectedAddressId}
                            className="space-y-4"
                        >
                            {addresses?.map((addr) => (
                                <div key={addr.id} className={cn("rounded-md border p-4 flex justify-between items-start", selectedAddressId === addr.id && 'border-primary ring-1 ring-primary')}>
                                    <Label htmlFor={addr.id} className="flex items-start space-x-4 cursor-pointer flex-1">
                                        <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-sm">Shipping from</p>
                                            <p className="font-medium">{addr.fullName}</p>
                                            <p className="text-sm text-muted-foreground">{addr.address}</p>
                                            <p className="text-sm text-muted-foreground">{addr.city}, {addr.postal}, {addr.country}</p>
                                        </div>
                                    </Label>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(addr)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </RadioGroup>
                    )}

                    <Button variant="outline" className="w-full" onClick={handleAdd}>
                        <Plus className="mr-2 h-4 w-4" /> Add new address
                    </Button>

                    <StepActions onNext={handleContinue} isNextDisabled={!selectedAddressId} />
                </div>
            </CardContent>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                </DialogHeader>
                {user && (
                    <AddressForm
                        userId={user.uid}
                        addressToEdit={editingAddress}
                        onSave={() => setIsFormOpen(false)}
                    />
                )}
                </DialogContent>
            </Dialog>
        </Card>
    )
}
