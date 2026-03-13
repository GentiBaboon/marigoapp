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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep4Schema, type FirestoreCategory, type FirestoreAttribute } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Combobox } from '@/components/ui/combobox';

type Step4Values = z.infer<typeof sellStep4Schema>;

export function DetailsStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const firestore = useFirestore();

  // Dynamic Metadata Fetching
  const categoriesQuery = useMemoFirebase(() => collection(firestore, 'categories'), [firestore]);
  const { data: categories } = useCollection<FirestoreCategory>(categoriesQuery);

  const conditionsQuery = useMemoFirebase(() => collection(firestore, 'conditions'), [firestore]);
  const { data: conditions } = useCollection<FirestoreAttribute>(conditionsQuery);

  const materialsQuery = useMemoFirebase(() => collection(firestore, 'materials'), [firestore]);
  const { data: materials } = useCollection<FirestoreAttribute>(materialsQuery);

  const colorsQuery = useMemoFirebase(() => collection(firestore, 'colors'), [firestore]);
  const { data: colors } = useCollection<FirestoreAttribute>(colorsQuery);

  const patternsQuery = useMemoFirebase(() => collection(firestore, 'patterns'), [firestore]);
  const { data: patterns } = useCollection<FirestoreAttribute>(patternsQuery);

  const form = useForm<Step4Values>({
    resolver: zodResolver(sellStep4Schema),
    defaultValues: {
      condition: formData.condition || '',
      material: formData.material || '',
      color: formData.color || '',
      sizeValue: formData.sizeValue || '',
      pattern: formData.pattern || '',
      vintage: formData.vintage || false,
    },
  });

  const categoryPath = React.useMemo(() => {
    if (!formData.subcategoryId || !categories) return '';
    const sub = categories.find(c => c.slug === formData.subcategoryId);
    const parent = categories.find(c => c.id === sub?.parentId);
    return parent ? `${parent.name} / ${sub?.name}` : sub?.name || '';
  }, [formData.subcategoryId, categories]);

  const onSubmit = (data: Step4Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-2">
            <h2 className="text-2xl font-bold font-headline">Item Details</h2>
            <p className="text-sm text-muted-foreground">{categoryPath}</p>
        </div>

        <FormField
          control={form.control}
          name="condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Condition</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {conditions?.map(c => (
                    <SelectItem key={c.id} value={c.value}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="material"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel className="font-semibold">Material</FormLabel>
                    <FormControl>
                        <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        items={materials?.map(m => ({ value: m.value, label: m.name })) || []}
                        placeholder="Material"
                        searchPlaceholder="Search..."
                        emptyPlaceholder="No results."
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel className="font-semibold">Color</FormLabel>
                    <FormControl>
                        <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        items={colors?.map(c => ({ value: c.value, label: c.name })) || []}
                        placeholder="Color"
                        searchPlaceholder="Search..."
                        emptyPlaceholder="No results."
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="sizeValue"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-semibold">Size</FormLabel>
                    <FormControl><Input placeholder="e.g. 42 / M" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel className="font-semibold">Pattern</FormLabel>
                    <FormControl>
                        <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        items={patterns?.map(p => ({ value: p.value, label: p.name })) || []}
                        placeholder="Pattern"
                        searchPlaceholder="Search..."
                        emptyPlaceholder="No results."
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="vintage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base font-semibold">Vintage Item</FormLabel>
                <p className="text-xs text-muted-foreground">Item is 15+ years old.</p>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )}
        />

        <StepActions onNext={form.handleSubmit(onSubmit)} />
      </form>
    </Form>
  );
}
