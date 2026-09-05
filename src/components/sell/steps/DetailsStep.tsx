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
import { Switch } from '@/components/ui/switch';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep4Schema, canUseVariants, type FirestoreCategory, type FirestoreAttribute, type FirestoreUser } from '@/lib/types';
import { toAttributeItems } from '@/lib/attribute-options';
import { useBadgeSettings } from '@/hooks/use-badge-settings';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Combobox } from '@/components/ui/combobox';
import { resolveSizeOptions, resolveSizeSystems } from '@/lib/size-options';

type Step4Values = z.infer<typeof sellStep4Schema>;

export function DetailsStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const firestore = useFirestore();
  const { user } = useUser();

  // Official Brand sellers set size per-variant in PricingStep, so we hide the
  // single-size picker here to avoid asking twice.
  const sellerRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore],
  );
  const { data: sellerProfile } = useDoc<FirestoreUser>(sellerRef);
  const { data: badgeSettings } = useBadgeSettings();
  // Per-tier feature: which sellers can list with per-size variants. When a
  // seller can use variants, the single-size picker on this step is hidden;
  // they set size per-variant in PricingStep instead.
  const isOfficialBrand = canUseVariants(sellerProfile, badgeSettings);

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

  // Size charts, used to populate the Size System + Size dropdowns based on
  // the chosen category (e.g. Shoes / Clothing / Bags).
  const sizeChartsQuery = useMemoFirebase(() => collection(firestore, 'size_charts'), [firestore]);
  const { data: sizeChartsRaw } = useCollection<{ id: string; categoryType: string; sizeSystem: string; sizes: string[]; isActive?: boolean }>(sizeChartsQuery);

  const form = useForm<Step4Values>({
    resolver: zodResolver(sellStep4Schema),
    defaultValues: {
      condition: formData.condition || '',
      material: formData.material || '',
      color: formData.color || '',
      sizeValue: formData.sizeValue || '',
      sizeSystem: formData.sizeSystem || '',
      pattern: formData.pattern || '',
      vintage: formData.vintage || false,
    },
  });

  const categoryPath = React.useMemo(() => {
    if (!formData.subcategoryId || !categories) return '';
    // Multiple subcategories can share a slug across different parents
    // (e.g. "Sandals" under both women's "Shoes" and "Children's Shoes").
    // Disambiguate using formData.categoryId, which stores the parent name.
    const candidates = categories.filter(c => c.slug === formData.subcategoryId);
    const sub = candidates.length > 1
      ? candidates.find(c => categories.find(p => p.id === c.parentId)?.name === formData.categoryId) || candidates[0]
      : candidates[0];
    const parent = categories.find(c => c.id === sub?.parentId);
    return parent ? `${parent.name} / ${sub?.name}` : sub?.name || '';
  }, [formData.subcategoryId, formData.categoryId, categories]);

  // Option shape is resolved in `@/lib/attribute-options` — the catalog
  // collections disagree on the field name and none of these rows can be read
  // as `.value` directly.
  const conditionItems = React.useMemo(() => toAttributeItems(conditions), [conditions]);
  const materialItems = React.useMemo(() => toAttributeItems(materials), [materials]);
  const colorItems = React.useMemo(() => toAttributeItems(colors), [colors]);
  const patternItems = React.useMemo(() => toAttributeItems(patterns), [patterns]);

  // Systems and sizes both resolve through src/lib/size-options.ts, which
  // walks admin chart → built-in preset → universal list. That is what lets
  // every category offer a dropdown: there is no combination that comes back
  // empty, so the seller is never dropped into a free-text box (which is how
  // "Small" and "S" ended up as separate, mutually invisible sizes).
  const watchedSizeSystem = form.watch('sizeSystem');

  const availableSystems = React.useMemo(
    () => resolveSizeSystems(formData.categoryId, sizeChartsRaw),
    [formData.categoryId, sizeChartsRaw],
  );

  const sizeOptions = React.useMemo(
    () => resolveSizeOptions({
      categoryType: formData.categoryId,
      sizeSystem: watchedSizeSystem,
      charts: sizeChartsRaw,
    }),
    [formData.categoryId, watchedSizeSystem, sizeChartsRaw],
  );

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
                  {conditionItems.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
                        items={materialItems}
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
                        items={colorItems}
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

        {!isOfficialBrand && (
        <div className="space-y-3">
          <FormLabel className="font-semibold">Size</FormLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sizeSystem"
              render={({ field }) => (
                <FormItem>
                  <Select
                    value={field.value || ''}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // Changing the system invalidates the previously
                      // chosen size — reset it so the user can pick a
                      // value that exists in the new chart.
                      form.setValue('sizeValue', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="System (EU, US, ...)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableSystems.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sizeValue"
              render={({ field }) => (
                <FormItem>
                  {/* Combobox rather than Select: the numeric charts run to
                      30-odd entries, and its label search means typing
                      "medium" still lands on the canonical value `M`. */}
                  <Combobox
                    items={sizeOptions}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    placeholder="Size"
                    searchPlaceholder="Search sizes..."
                    emptyPlaceholder="No matching size."
                    className="h-12"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        )}

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
                  items={patternItems}
                  placeholder="Pattern"
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
          name="vintage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base font-semibold">Vintage Item</FormLabel>
                <p className="text-xs text-muted-foreground">Item is 5+ years old.</p>
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
