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
import { sellStep4Schema, canUseVariants, type FirestoreCategory, type FirestoreAttribute, type FirestoreUser } from '@/lib/types';
import { useBadgeSettings } from '@/hooks/use-badge-settings';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Combobox } from '@/components/ui/combobox';

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

  // Build combobox items from a Firestore attribute collection. Some seeded
  // records lack the `value` field — fall back to a slugified name so the
  // option still renders and remains selectable.
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const toAttributeItems = React.useCallback((rows?: FirestoreAttribute[] | null) => {
    if (!rows) return [];
    return rows
      .filter((r) => typeof r?.name === 'string' && r.name.trim().length > 0)
      .map((r) => ({
        value: (r.value && r.value.trim()) || slugify(r.name),
        label: r.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const materialItems = React.useMemo(() => toAttributeItems(materials), [materials, toAttributeItems]);
  const colorItems = React.useMemo(() => toAttributeItems(colors), [colors, toAttributeItems]);
  const patternItems = React.useMemo(() => toAttributeItems(patterns), [patterns, toAttributeItems]);

  // Charts whose categoryType matches the product's parent category (e.g.
  // "Shoes" for a sandals listing). If none match we fall back to all
  // active charts so the seller still has something to choose from.
  const applicableCharts = React.useMemo(() => {
    if (!sizeChartsRaw) return [];
    const all = sizeChartsRaw.filter(c => c.isActive !== false);
    const match = all.filter(c => c.categoryType === formData.categoryId);
    return match.length > 0 ? match : all;
  }, [sizeChartsRaw, formData.categoryId]);

  const availableSystems = React.useMemo(
    () => Array.from(new Set(applicableCharts.map(c => c.sizeSystem))),
    [applicableCharts],
  );

  const watchedSizeSystem = form.watch('sizeSystem');
  const activeChart = React.useMemo(
    () => applicableCharts.find(c => c.sizeSystem === watchedSizeSystem),
    [applicableCharts, watchedSizeSystem],
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
                  {conditions?.map(c => {
                    const val = (c.value && c.value.trim()) || slugify(c.name);
                    return (
                      <SelectItem key={c.id} value={val}>{c.name}</SelectItem>
                    );
                  })}
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
                      {availableSystems.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No size chart for this category.</div>
                      ) : (
                        availableSystems.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))
                      )}
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
                  {activeChart && activeChart.sizes.length > 0 ? (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeChart.sizes.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        placeholder={watchedSizeSystem ? 'Size' : 'e.g. 42 / M'}
                        className="h-12"
                        {...field}
                      />
                    </FormControl>
                  )}
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
