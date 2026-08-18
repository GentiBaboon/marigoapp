'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep3Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';


type Step3Values = z.infer<typeof sellStep3Schema>;

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

// `origin` is a free string in the schema, not an enum, so trimming this list
// cannot invalidate a listing already saved with a retired value.
const originOptions = [
    { value: 'direct', label: 'Direct from brand' },
    { value: 'other', label: 'Other' },
]

const packagingItems = [
    { id: 'card', label: 'Card or certificate' },
    { id: 'dustBag', label: 'Dust bag' },
    { id: 'box', label: 'Original box' },
]

export function DescriptionStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const form = useForm<Step3Values>({
    resolver: zodResolver(sellStep3Schema),
    defaultValues: {
      title: formData.title || '',
      description: formData.description || '',
      origin: formData.origin || '',
      yearOfPurchase: formData.yearOfPurchase || '',
      serialNumber: formData.serialNumber || '',
      packaging: formData.packaging || [],
    },
  });

  const onSubmit = (data: Step3Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Add details about your item to attract buyers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chanel Classic Medium Double Flap Bag" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the item's features, history, and any imperfections."
                      className="resize-y min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />

            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel>Origin <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="space-y-2"
                    >
                      {originOptions.map((option) => (
                        <FormItem key={option.value} className="flex items-center space-x-3">
                          <FormControl>
                            <RadioGroupItem value={option.value} />
                          </FormControl>
                          <FormLabel className="font-normal">{option.label}</FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="yearOfPurchase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year of purchase <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial number <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormDescription>
                    This information will not be publicly displayed.
                  </FormDescription>
                  <FormControl>
                    <Input placeholder="Serial number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="packaging"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Packaging <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  </div>
                  {packagingItems.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="packaging"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0 mb-3"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), item.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />

            <StepActions onNext={form.handleSubmit(onSubmit)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
