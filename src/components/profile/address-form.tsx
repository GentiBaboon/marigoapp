'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { addressSchema, type AddressFormValues, type FirestoreAddress } from '@/lib/types';
import { countries } from '@/lib/countries';

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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddressFormProps {
  userId: string;
  addressToEdit?: FirestoreAddress | null;
  onSave: () => void;
  /**
   * Pin the save button to the bottom of the panel.
   *
   * Right in the scrolling dialogs this form normally opens in, where the
   * button would otherwise sit below the fold. Wrong on a page that scrolls
   * behind the fixed mobile nav — there the button pins *underneath* the nav
   * and all but disappears, so the checkout's inline copy opts out.
   */
  stickyFooter?: boolean;
}

/**
 * Split a stored `fullName` back into the two inputs.
 *
 * Addresses saved before the name was captured as two fields only have the
 * combined value, and opening one for editing should not present an empty
 * form. Everything up to the last space is the first name, so "Sara Lekaj"
 * and "Ana Maria Lekaj" both keep "Lekaj" as the surname.
 */
function splitName(fullName: string): { firstName: string; surname: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', surname: '' };
  if (parts.length === 1) return { firstName: parts[0], surname: '' };
  return { firstName: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] };
}

const EMPTY: AddressFormValues = {
  firstName: '', surname: '', fullName: '', company: '',
  phone: '', address: '', apartment: '', city: '', postal: '', country: '',
};

export function AddressForm({ userId, addressToEdit, onSave, stickyFooter = true }: AddressFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [phoneCode, setPhoneCode] = React.useState<string | undefined>();
  const [phoneNumber, setPhoneNumber] = React.useState('');

  const sortedCountriesByPhoneCode = React.useMemo(
    () => [...countries].sort((a, b) => b.phone.length - a.phone.length),
    []
  );

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY,
  });

  const countryValue = form.watch('country');
  const firstNameValue = form.watch('firstName');
  const surnameValue = form.watch('surname');

  React.useEffect(() => {
    if (addressToEdit) {
      const stored = splitName(addressToEdit.fullName || '');
      form.reset({
        ...EMPTY,
        ...addressToEdit,
        // Older addresses carry only the combined name.
        firstName: addressToEdit.firstName || stored.firstName,
        surname: addressToEdit.surname || stored.surname,
      });

      const foundCountry = sortedCountriesByPhoneCode.find(c => addressToEdit.phone.startsWith(c.phone));
      if (foundCountry) {
        setPhoneCode(foundCountry.phone);
        setPhoneNumber(addressToEdit.phone.substring(foundCountry.phone.length));
      } else {
        setPhoneNumber(addressToEdit.phone);
      }
    } else {
      form.reset(EMPTY);
      setPhoneCode(undefined);
      setPhoneNumber('');
    }
  }, [addressToEdit, form, sortedCountriesByPhoneCode]);

  React.useEffect(() => {
    form.setValue('phone', `${phoneCode || ''}${phoneNumber}`);
  }, [phoneCode, phoneNumber, form]);

  // `fullName` is what the rest of the app reads, so keep it composed from the
  // two visible inputs rather than storing the halves alone.
  React.useEffect(() => {
    const composed = [firstNameValue, surnameValue]
      .map(part => (part || '').trim())
      .filter(Boolean)
      .join(' ');
    form.setValue('fullName', composed);
  }, [firstNameValue, surnameValue, form]);

  React.useEffect(() => {
    const selectedCountry = countries.find(c => c.name.toLowerCase() === countryValue?.toLowerCase());
    if (selectedCountry) {
      setPhoneCode(selectedCountry.phone);
    }
  }, [countryValue]);

  // Cities offered for the chosen country. Delivery is priced per origin city,
  // so a picked value beats typed spelling: "Tirane" and "Tirana" would
  // otherwise be billed as two separate courier runs.
  const citiesForCountry = React.useMemo(() => {
    const match = countries.find(c => c.name.toLowerCase() === (countryValue || '').toLowerCase());
    return match?.cities ?? [];
  }, [countryValue]);

  // A stored country outside the current list — see the note in the picker.
  const legacyCountry = React.useMemo(() => {
    const value = (countryValue || '').trim();
    if (!value) return '';
    const known = countries.some(c => c.name.toLowerCase() === value.toLowerCase());
    return known ? '' : value;
  }, [countryValue]);

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-2">
        <section className="space-y-4">
          <h3 className="font-headline text-xl font-bold">Contact</h3>

          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Sara" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="surname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Surname</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Lekaj" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Code and number sit on one row, each with its own label, so the
              country prefix reads as part of the number rather than a
              separate question. */}
          <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
            <FormItem className="space-y-2">
              <FormLabel>Phone code</FormLabel>
              <Select value={phoneCode} onValueChange={setPhoneCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Code" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.phone}>
                      {country.phone} ({country.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>

            <FormItem className="space-y-2">
              <FormLabel>Mobile number</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 692345678"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </FormControl>
              <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
            </FormItem>
          </div>

          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Marigo sh.p.k."
                    autoComplete="organization"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-4">
          <h3 className="font-headline text-xl font-bold">Location</h3>

          {/* Country leads the section because it decides which cities the
              picker below can offer. */}
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <Select
                  value={field.value || ''}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // The city list is per country, so a previously chosen city
                    // would otherwise linger and no longer be selectable.
                    form.setValue('city', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.name}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                    {/* An address saved before the list was narrowed to Albania
                        and Kosovo keeps its own country as an option, so
                        editing one does not silently blank a real value. */}
                    {legacyCountry && (
                      <SelectItem value={legacyCountry}>{legacyCountry}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Rruga Sami Frashëri"
                    autoComplete="address-line1"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apartment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apartment, suite, building (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Pallati 12, Shkalla 2, Ap. 7"
                    autoComplete="address-line2"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                {citiesForCountry.length > 0 ? (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {citiesForCountry.map((city) => (
                        <SelectItem key={city.name} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // No list for this country — keep it typeable rather than
                  // blocking the address entirely.
                  <FormControl>
                    <Input placeholder="e.g. Tirana" {...field} />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 1001"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Pinned to the bottom of the scrolling panel: the form is now long
            enough that a button at its end would sit below the fold. The bar
            carries its own bottom padding — the dialog sets `pb-0` so that the
            scrollport ends exactly here, otherwise fields scroll through the
            container's padding underneath the button. */}
        <div
          className={cn(
            'border-t bg-background pt-4',
            stickyFooter ? 'sticky bottom-0 pb-6' : 'pb-1'
          )}
        >
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full text-sm font-bold uppercase tracking-widest"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save address
          </Button>
        </div>
      </form>
    </Form>
  );
}
