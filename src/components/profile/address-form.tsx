'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { addressSchema, type AddressFormValues, type FirestoreAddress } from '@/lib/types';
import { countries, type Country } from '@/lib/countries';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '../ui/separator';

interface AddressFormProps {
  userId: string;
  addressToEdit?: FirestoreAddress | null;
  onSave: () => void;
}

export function AddressForm({ userId, addressToEdit, onSave }: AddressFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedCountry, setSelectedCountry] = React.useState<Country | undefined>();
  const [phoneCode, setPhoneCode] = React.useState<string | undefined>();
  const [phoneNumber, setPhoneNumber] = React.useState('');

  const sortedCountriesByPhoneCode = React.useMemo(
    () => [...countries].sort((a, b) => b.phone.length - a.phone.length),
    []
  );

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      address: '',
      city: '',
      postal: '',
      country: '',
    },
  });

  React.useEffect(() => {
    if (addressToEdit) {
      form.reset(addressToEdit);
      const country = countries.find(c => c.name.toLowerCase() === addressToEdit.country.toLowerCase());
      setSelectedCountry(country);
      
      const foundCountry = sortedCountriesByPhoneCode.find(c => addressToEdit.phone.startsWith(c.phone));
      if (foundCountry) {
        setPhoneCode(foundCountry.phone);
        setPhoneNumber(addressToEdit.phone.substring(foundCountry.phone.length));
      } else {
        setPhoneNumber(addressToEdit.phone);
      }
    } else {
        form.reset({
          fullName: '', phone: '', address: '', city: '', postal: '', country: '',
        });
        setSelectedCountry(undefined);
        setPhoneCode(undefined);
        setPhoneNumber('');
    }
  }, [addressToEdit, form, sortedCountriesByPhoneCode]);

  React.useEffect(() => {
    form.setValue('phone', `${phoneCode || ''}${phoneNumber}`);
  }, [phoneCode, phoneNumber, form]);

  async function onSubmit(data: AddressFormValues) {
    if (!firestore) return;
    setIsLoading(true);

    const addressesCollection = collection(firestore, 'users', userId, 'addresses');

    try {
      if (addressToEdit) {
        const addressRef = doc(addressesCollection, addressToEdit.id);
        await updateDoc(addressRef, data);
        toast({ title: 'Address updated successfully.' });
      } else {
        await addDoc(addressesCollection, { ...data, isDefault: false });
        toast({ title: 'Address added successfully.' });
      }
      onSave();
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

  const handleCountryChange = (countryName: string) => {
    const country = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
    setSelectedCountry(country);
    form.setValue('country', countryName, { shouldValidate: true });
    form.setValue('city', '', { shouldValidate: true }); // Reset city
    if (country) {
      setPhoneCode(country.phone);
    }
  };

  const countryItems = countries.map(c => ({ value: c.name, label: c.name }));
  const cityItems = selectedCountry?.cities.map(c => ({ value: c.name, label: c.name })) || [];

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
                <Input placeholder="e.g. Genti Selenica" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <div className="flex items-start gap-2">
                <Select value={phoneCode} onValueChange={setPhoneCode}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                        {countries.map((country) => (
                        <SelectItem key={country.code} value={country.phone}>
                            <span className="flex items-center gap-2">{country.flag} {country.code}</span>
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="w-full">
                    <Input 
                        placeholder="e.g. 67700900" 
                        value={phoneNumber} 
                        onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <FormMessage className="mt-2">{form.formState.errors.phone?.message}</FormMessage>
                </div>
            </div>
        </FormItem>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
            <FormItem className="flex flex-col">
                <FormLabel>Country</FormLabel>
                <FormControl>
                    <Combobox
                        value={field.value}
                        onValueChange={handleCountryChange}
                        items={countryItems}
                        placeholder="Select country"
                        searchPlaceholder="Search countries..."
                        emptyPlaceholder="No country found."
                    />
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
                <FormItem className="flex flex-col">
                <FormLabel>City</FormLabel>
                <FormControl>
                    <Combobox
                        value={field.value}
                        onValueChange={(value) => form.setValue('city', value, { shouldValidate: true })}
                        items={cityItems}
                        placeholder="Select city"
                        searchPlaceholder="Search cities..."
                        emptyPlaceholder="No city found."
                        disabled={!selectedCountry}
                    />
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
                  <Input placeholder="e.g. 10001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
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
