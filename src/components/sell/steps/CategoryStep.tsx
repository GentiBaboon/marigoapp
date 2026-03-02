
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep2Schema } from '@/lib/types';
import type { z } from 'zod';
import { productCategories } from '@/lib/mock-data';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { brands } from '@/lib/mock-data';
import { StepActions } from '../StepActions';

type Step2Values = z.infer<typeof sellStep2Schema>;

const categoryItems = productCategories.flatMap(group => 
    group.subcategories.map(item => ({ value: item.slug, label: item.name }))
);

export function CategoryStep() {
  const { formData, setFormData, nextStep } = useSellForm();

  const form = useForm<Step2Values>({
    resolver: zodResolver(sellStep2Schema),
    defaultValues: {
      gender: (formData.gender as any) || 'women',
      categoryId: formData.categoryId || '',
      subcategoryId: formData.subcategoryId || '',
      brandId: formData.brandId || '',
    },
  });

  const onSubmit = (data: Step2Values) => {
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
                    {[
                      { value: 'women', label: 'Womenswear' },
                      { value: 'men', label: 'Menswear' },
                      { value: 'children', label: 'Children' },
                      { value: 'unisex', label: 'Unisex' }
                    ].map(
                      (g) => (
                        <FormItem key={g.value} className="flex items-center">
                          <FormControl>
                            <Label
                              className={cn(
                                'flex w-full cursor-pointer items-center gap-4 rounded-md border p-4 transition-colors hover:border-primary',
                                genderValue === g.value
                                  ? 'border-primary ring-2 ring-primary'
                                  : 'border-input'
                              )}
                            >
                              <RadioGroupItem value={g.value} />
                              <span className="font-medium">{g.label}</span>
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
            name="subcategoryId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="font-semibold">Category</FormLabel>
                <FormControl>
                  <Combobox
                      value={field.value}
                      onValueChange={(val) => {
                          field.onChange(val);
                          // Determine categoryId based on subcategory
                          for (const cat of productCategories) {
                              if (cat.subcategories.some(s => s.slug === val)) {
                                  form.setValue('categoryId', cat.name.toLowerCase());
                                  break;
                              }
                          }
                      }}
                      items={categoryItems}
                      placeholder="Select item type"
                      searchPlaceholder="Search categories..."
                      emptyPlaceholder="No category found."
                    />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="brandId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="font-semibold">Brand</FormLabel>
                <FormControl>
                  <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      items={brands.map((brand) => ({
                        value: brand.name,
                        label: brand.name,
                      }))}
                      placeholder="Select brand"
                      searchPlaceholder="Search brands..."
                      emptyPlaceholder="No brand found."
                    />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <StepActions onNext={form.handleSubmit(onSubmit)} backText="Back to drafts" />
        </form>
      </Form>
  );
}
