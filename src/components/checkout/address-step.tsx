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
import { savedAddresses } from '@/lib/mock-data';
import { addressSchema, type AddressFormValues } from '@/lib/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Home, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type AddressStepProps = {
  onNextStep: () => void;
};

export function AddressStep({ onNextStep }: AddressStepProps) {
  const [selectedAddress, setSelectedAddress] = useState(
    savedAddresses.find((a) => a.isDefault)?.id
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

  function onSubmit(data: AddressFormValues) {
    console.log('New address submitted:', data);
    // Here you would typically save the new address and then proceed
    onNextStep();
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
          value={selectedAddress}
          onValueChange={setSelectedAddress}
          className="space-y-4"
        >
          {savedAddresses.map((addr) => (
            <Label
              key={addr.id}
              htmlFor={addr.id}
              className={cn(
                'flex items-start space-x-4 rounded-md border p-4 cursor-pointer transition-colors',
                selectedAddress === addr.id && 'border-primary ring-1 ring-primary'
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

        <Accordion type="single" collapsible>
          <AccordionItem value="new-address" className="border-b-0">
            <AccordionTrigger>
                <div className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4" />
                    <span>Add a new address</span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                            <Input {...field} />
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
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <Button type="submit" className="w-full md:w-auto">Save and Continue</Button>
                </form>
              </Form>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <div className="pt-4">
          <Button
            size="lg"
            className="w-full"
            onClick={onNextStep}
            disabled={!selectedAddress}
          >
            Continue to Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
