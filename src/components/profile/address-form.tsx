'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { addressSchema, type AddressFormValues, type FirestoreAddress } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AddressFormProps {
  userId: string;
  addressToEdit?: FirestoreAddress | null;
  onSave: () => void;
}

export function AddressForm({ userId, addressToEdit, onSave }: AddressFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: addressToEdit || {
      fullName: '',
      phone: '',
      address: '',
      city: '',
      postal: '',
      country: '',
    },
  });
  
  React.useEffect(() => {
      form.reset(addressToEdit || {
        fullName: '',
        phone: '',
        address: '',
        city: '',
        postal: '',
        country: '',
      });
  }, [addressToEdit, form]);

  async function onSubmit(data: AddressFormValues) {
    if (!firestore) return;
    setIsLoading(true);

    const addressesCollection = collection(firestore, 'users', userId, 'addresses');

    try {
      if (addressToEdit) {
        // Update existing address
        const addressRef = doc(addressesCollection, addressToEdit.id);
        await updateDoc(addressRef, data);
        toast({ title: 'Address updated successfully.' });
      } else {
        // Add new address
        await addDoc(addressesCollection, { ...data, isDefault: false });
        toast({ title: 'Address added successfully.' });
      }
      onSave(); // Close dialog
    } catch (error) {
      console.error('Error saving address:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save address. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="+1 234 567 890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="New York" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="10001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input placeholder="United States" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {addressToEdit ? 'Save Changes' : 'Add Address'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
