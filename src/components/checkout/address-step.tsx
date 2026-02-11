'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { addressSchema, type AddressFormValues, type FirestoreAddress } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import {
  Form
} from '@/components/ui/form';
import { AddressForm } from '@/components/profile/address-form';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

type AddressStepProps = {
  onNextStep: (address: FirestoreAddress) => void;
};

export function AddressStep({ onNextStep }: AddressStepProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);

  const { data: addresses, isLoading: areAddressesLoading } = useCollection<FirestoreAddress>(addressesCollection);

  const defaultAddress = addresses?.find(a => a.isDefault);

  useState(() => {
    if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
    }
  });

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
  });

  const handleContinue = () => {
    const selectedAddress = addresses?.find(a => a.id === selectedAddressId);
    if (selectedAddress) {
        onNextStep(selectedAddress);
    }
  };

  if (areAddressesLoading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping Address</CardTitle>
        <CardDescription>
          Choose a saved address or add a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedAddressId}
          onValueChange={setSelectedAddressId}
          className="space-y-4"
        >
          {addresses?.map((addr) => (
            <Label
              key={addr.id}
              htmlFor={addr.id}
              className={cn(
                'flex items-start space-x-4 rounded-md border p-4 cursor-pointer transition-colors',
                selectedAddressId === addr.id && 'border-primary ring-1 ring-primary'
              )}
            >
              <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium flex items-center">
                  {addr.fullName} {addr.isDefault && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {addr.address}, {addr.city}, {addr.postal}, {addr.country}
                </p>
                <p className="text-sm text-muted-foreground">{addr.phone}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <Accordion type="single" collapsible onValueChange={(value) => setIsFormOpen(value === 'new-address')}>
          <AccordionItem value="new-address" className="border-b-0">
            <AccordionTrigger>
                <div className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4" />
                    <span>Add a new address</span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <Form {...form}>
                {user && (
                    <AddressForm userId={user.uid} onSave={() => setIsFormOpen(false)} />
                )}
              </Form>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {!isFormOpen && (
            <div className="pt-4">
            <Button
                size="lg"
                className="w-full"
                onClick={handleContinue}
                disabled={!selectedAddressId}
            >
                Continue to Payment
            </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
