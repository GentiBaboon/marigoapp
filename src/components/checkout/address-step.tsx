'use client';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { AddressForm } from '@/components/profile/address-form';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import type { FirestoreAddress } from '@/lib/types';

type AddressStepProps = {
  onNextStep: (address: FirestoreAddress) => void;
};

export function AddressStep({ onNextStep }: AddressStepProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>();
  const [isAddingNew, setIsAddingNew] = useState(false);

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);

  const { data: addresses, isLoading } = useCollection<FirestoreAddress>(addressesCollection);

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
        const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
        setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  const handleContinue = () => {
    const selected = addresses?.find(a => a.id === selectedAddressId);
    if (selected) {
        onNextStep(selected);
    }
  };

  if (isLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-10 w-48" />
              <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
        <div className="space-y-1">
            <h2 className="text-2xl font-bold font-headline">Shipping Address</h2>
            <p className="text-muted-foreground text-sm">Where should we send your items?</p>
        </div>
        
        {isAddingNew ? (
            <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg">Add New Address</CardTitle>
                    <CardDescription>Enter your delivery details below.</CardDescription>
                </CardHeader>
                <CardContent>
                    {user && (
                        <AddressForm 
                            userId={user.uid} 
                            onSave={() => setIsAddingNew(false)} 
                        />
                    )}
                    <Button variant="ghost" className="mt-4 w-full" onClick={() => setIsAddingNew(false)}>
                        Cancel
                    </Button>
                </CardContent>
            </Card>
        ) : (
            <div className="space-y-4">
                {addresses && addresses.length > 0 ? (
                    <RadioGroup
                        value={selectedAddressId}
                        onValueChange={setSelectedAddressId}
                        className="grid gap-4"
                    >
                        {addresses.map((addr) => (
                            <Label
                                key={addr.id}
                                htmlFor={addr.id}
                                className={cn(
                                    'relative flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all duration-200',
                                    selectedAddressId === addr.id 
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                        : 'border-muted bg-background hover:bg-muted/30'
                                )}
                            >
                                <div className="flex items-center h-5 mr-4">
                                    <RadioGroupItem value={addr.id} id={addr.id} className="text-primary" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-base">{addr.fullName}</span>
                                        {addr.isDefault && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        {addr.address}<br />
                                        {addr.city}, {addr.postal}, {addr.country}
                                    </p>
                                    <p className="text-xs font-medium text-muted-foreground mt-2">{addr.phone}</p>
                                </div>
                                {selectedAddressId === addr.id && (
                                    <div className="absolute top-4 right-4 bg-primary text-white rounded-full p-0.5">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </Label>
                        ))}
                    </RadioGroup>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/20">
                        <p className="text-muted-foreground text-sm">No saved addresses found.</p>
                    </div>
                )}

                <Button 
                    variant="outline" 
                    className="w-full h-16 rounded-xl border-dashed border-2 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                    onClick={() => setIsAddingNew(true)}
                >
                    <Plus className="h-5 w-5" />
                    <span className="font-semibold">Add a new address</span>
                </Button>

                <div className="pt-6">
                    <Button
                        size="lg"
                        className="w-full h-14 rounded-full text-base font-bold shadow-lg"
                        onClick={handleContinue}
                        disabled={!selectedAddressId}
                    >
                        Continue to Payment
                    </Button>
                </div>
            </div>
        )}
    </div>
  );
}