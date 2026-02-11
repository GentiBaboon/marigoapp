'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep1Schema } from '@/lib/types';
import type { z } from 'zod';
import { categories } from '@/lib/mock-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

type Step1Values = z.infer<typeof sellStep1Schema>;

export function CategoryStep() {
  const { formData, setFormData, nextStep } = useSellForm();

  const form = useForm<Step1Values>({
    resolver: zodResolver(sellStep1Schema),
    defaultValues: {
      gender: formData.gender,
      category: formData.category,
      brand: formData.brand || '',
    },
  });

  const onSubmit = (data: Step1Values) => {
    setFormData(data);
    nextStep();
  };

  const genderValue = form.watch('gender');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <FormLabel className="font-semibold">What type of item are you selling?</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="space-y-3"
                >
                  {['Womenswear', 'Menswear', 'Girlswear', 'Boyswear'].map(
                    (gender) => (
                      <FormItem key={gender} className="flex items-center">
                        <FormControl>
                          <Label
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-4 rounded-md border p-4 transition-colors hover:border-primary',
                              genderValue === gender.toLowerCase()
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-input'
                            )}
                          >
                            <RadioGroupItem value={gender.toLowerCase()} />
                            <span className="font-medium">{gender}</span>
                          </Label>
                        </FormControl>
                      </FormItem>
                    )
                  )}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="font-semibold">Brand</FormLabel>
               <FormControl>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                   <Input placeholder="Brand Name" {...field} className="pl-10" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </form>
    </Form>
  );
}
