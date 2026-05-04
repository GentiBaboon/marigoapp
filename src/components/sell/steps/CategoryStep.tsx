'use client';

import * as React from 'react';
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
import { sellStep2Schema, type FirestoreCategory, type FirestoreBrand } from '@/lib/types';
import type { z } from 'zod';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { StepActions } from '../StepActions';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Step2Values = z.infer<typeof sellStep2Schema>;

export function CategoryStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const firestore = useFirestore();

  // Fetch all categories. We filter active client-side because seeded records
  // may be missing the `isActive` field — a strict Firestore-level
  // `where('isActive','==',true)` would silently drop them.
  const categoriesQuery = useMemoFirebase(
    () => collection(firestore, 'categories'),
    [firestore],
  );
  const { data: categories } = useCollection<FirestoreCategory>(categoriesQuery);

  // Fetch Brands
  const brandsQuery = useMemoFirebase(() => collection(firestore, 'brands'), [firestore]);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQuery);

  const categoryTree = React.useMemo(() => {
    if (!categories) return [];
    const active = categories.filter(c => c.isActive !== false);
    const parents = active.filter(c => !c.parentId).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const subs = active.filter(c => c.parentId).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    return parents
      .map(p => ({
        heading: p.name,
        items: subs
          .filter(s => s.parentId === p.id)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(s => ({ value: s.slug, label: s.name })),
      }))
      .filter(g => g.items.length > 0);
  }, [categories]);

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

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <FormLabel className="font-semibold text-lg">What type of item are you selling?</FormLabel>
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
                                'flex w-full cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all hover:border-primary',
                                field.value === g.value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-muted'
                              )}
                            >
                              <RadioGroupItem value={g.value} />
                              <span className="font-semibold">{g.label}</span>
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
                          const sub = categories?.find(c => c.slug === val);
                          const parent = categories?.find(c => c.id === sub?.parentId);
                          if (parent) form.setValue('categoryId', parent.name);
                      }}
                      items={categoryTree}
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
                <div className="flex items-center gap-1.5">
                  <FormLabel className="font-semibold">Brand</FormLabel>
                  <Popover>
                    <PopoverTrigger
                      type="button"
                      aria-label="Brand help"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-72 text-xs leading-relaxed">
                      If you can not find the brand of your item, put it on item description on the next step and we will edit it before publishing.
                    </PopoverContent>
                  </Popover>
                </div>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    items={
                      brands
                        ?.slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(b => ({ value: b.name, label: b.name })) || []
                    }
                    placeholder="Select brand"
                    searchPlaceholder="Search brands..."
                    emptyPlaceholder="No brands found."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <StepActions onNext={form.handleSubmit(onSubmit)} />
        </form>
      </Form>
  );
}
