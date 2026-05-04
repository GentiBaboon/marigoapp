'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import { SlidersHorizontal, Loader2, X, ChevronDown, Search as SearchIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy,
  type QueryConstraint, limit, startAfter,
  getDocs, type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import type { FirestoreProduct, FirestoreCategory, FirestoreAttribute, FirestoreBrand } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40; // fetch more so client-side filtering has enough to show

const GENDERS = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'children', label: 'Children' },
  { value: 'unisex', label: 'Unisex' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton4() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function useAttributeData(firestore: ReturnType<typeof useFirestore>) {
  const brandsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'brands') : null), [firestore]);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQ);
  const categoriesQ = useMemoFirebase(() => (firestore ? collection(firestore, 'categories') : null), [firestore]);
  const { data: categories } = useCollection<FirestoreCategory>(categoriesQ);
  return { brands: brands ?? [], categories: categories ?? [] };
}

function useFilteredProducts(
  firestore: ReturnType<typeof useFirestore>,
  params: ReturnType<typeof useSearchParams>,
  brands: FirestoreBrand[],
  categories: FirestoreCategory[],
) {
  const category = params.get('category') ?? '';     // subcategoryId slug  → stored as slug in products
  const categoryId = params.get('categoryId') ?? ''; // parent category slug → stored as NAME in products
  const brand = params.get('brand') ?? '';           // brand slug           → stored as NAME in products
  const gender = params.get('gender') ?? '';
  const size = params.get('size') ?? '';
  const color = params.get('color') ?? '';
  const condition = params.get('condition') ?? '';
  const material = params.get('material') ?? '';
  const pattern = params.get('pattern') ?? '';
  const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
  const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
  const section = params.get('section') ?? '';
  const q = params.get('q') ?? '';

  // Resolve slug → stored name (products store brand/parent-category by name, not slug)
  const resolvedBrandName = React.useMemo(
    () => brands.find((b) => b.slug === brand)?.name ?? brand,
    [brands, brand],
  );
  const parentCategory = React.useMemo(
    () => categories.find((c) => c.slug === categoryId && !c.parentId),
    [categories, categoryId],
  );
  // Build a set of values a product's categoryId/subcategoryId might match this
  // parent under: doc id, slug, name, plus all child slugs/names. Handles
  // legacy/inconsistent product data.
  const parentMatchSet = React.useMemo(() => {
    const set = new Set<string>();
    if (!parentCategory) {
      if (categoryId) set.add(categoryId.toLowerCase());
      return set;
    }
    set.add(parentCategory.id.toLowerCase());
    set.add(parentCategory.slug.toLowerCase());
    set.add(parentCategory.name.toLowerCase());
    categories.forEach((c) => {
      if (c.parentId === parentCategory.id) {
        set.add(c.id.toLowerCase());
        if (c.slug) set.add(c.slug.toLowerCase());
        if (c.name) set.add(c.name.toLowerCase());
      }
    });
    return set;
  }, [categories, categoryId, parentCategory]);

  const [raw, setRaw] = React.useState<FirestoreProduct[]>([]);
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  // Build Firestore constraints.
  // subcategoryId stores slugs → can filter in Firestore.
  // brandId stores brand NAMES (not slugs) → must filter client-side.
  const buildConstraints = React.useCallback((): QueryConstraint[] => {
    // Include reserved items too — they stay browsable so shoppers see them
    // marked "Reserved" instead of disappearing entirely.
    const c: QueryConstraint[] = [where('status', 'in', ['active', 'reserved'])];
    if (category) c.push(where('subcategoryId', '==', category));
    c.push(orderBy('listingCreated', 'desc'));
    return c;
  }, [category]);

  React.useEffect(() => {
    if (!firestore) return;
    setIsLoading(true);
    setRaw([]);
    setLastDoc(null);
    setHasMore(true);

    const q2 = query(collection(firestore, 'products'), ...buildConstraints(), limit(PAGE_SIZE));
    getDocs(q2)
      .then((snap) => {
        setRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreProduct)));
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      })
      .catch((err) => {
        console.error('[Search] Firestore query failed:', err);
      })
      .finally(() => setIsLoading(false));
  }, [firestore, buildConstraints]);

  const loadMore = React.useCallback(async () => {
    if (!firestore || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const q2 = query(
        collection(firestore, 'products'),
        ...buildConstraints(),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q2);
      setRaw((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreProduct))]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [firestore, lastDoc, isLoadingMore, buildConstraints]);

  // Client-side filter — products.brandId stores the NAME, products.categoryId stores the NAME
  const products = React.useMemo(() => {
    let list = raw;
    if (gender) list = list.filter((p) => p.gender === gender);
    // brand: resolve slug → name, then compare to stored name
    if (brand) list = list.filter((p) => p.brandId === resolvedBrandName);
    // parent category: match against the parent's id/slug/name AND all of its
    // children's id/slug/name — products may store the value as the parent
    // name, the parent slug, or any subcategory id/slug.
    if (categoryId)
      list = list.filter((p) => {
        const c = (p.categoryId ?? '').toLowerCase();
        const s = (p.subcategoryId ?? '').toLowerCase();
        return parentMatchSet.has(c) || parentMatchSet.has(s);
      });
    if (size) list = list.filter((p) => p.size === size);
    if (color) list = list.filter((p) => p.color === color);
    if (condition) list = list.filter((p) => p.condition === condition);
    if (material) list = list.filter((p) => (p as any).material === material);
    if (pattern) list = list.filter((p) => (p as any).pattern === pattern);
    if (minPrice !== null) list = list.filter((p) => p.price >= minPrice);
    if (maxPrice !== null) list = list.filter((p) => p.price <= maxPrice);
    if (section === 'new-arrivals') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => {
        const ts = (p.listingCreated as any)?.seconds;
        return ts ? ts * 1000 >= thirtyDaysAgo : true;
      });
    }
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(lower) ||
          p.brandId?.toLowerCase().includes(lower) ||
          (p as any).description?.toLowerCase().includes(lower),
      );
    }
    return list;
  }, [raw, gender, brand, resolvedBrandName, category, categoryId, parentMatchSet, size, color, condition, material, pattern, minPrice, maxPrice, section, q]);

  const activeFilterCount = [gender, category, categoryId, brand, size, color, condition, material, pattern,
    minPrice !== null ? '1' : '', maxPrice !== null ? '1' : '']
    .filter(Boolean).length;

  return { products, isLoading, isLoadingMore, hasMore, loadMore, activeFilterCount };
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

function FilterSheet({
  open,
  onOpenChange,
  priceRange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  priceRange?: { min: number; max: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  // Load attribute collections from Firestore
  const categoriesQ = useMemoFirebase(() => (firestore ? collection(firestore, 'categories') : null), [firestore]);
  const { data: allCategories } = useCollection<FirestoreCategory>(categoriesQ);
  const brandsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'brands') : null), [firestore]);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQ);
  const conditionsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'conditions') : null), [firestore]);
  const { data: conditions } = useCollection<FirestoreAttribute>(conditionsQ);
  const colorsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'colors') : null), [firestore]);
  const { data: colors } = useCollection<FirestoreAttribute>(colorsQ);
  const materialsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'materials') : null), [firestore]);
  const { data: materials } = useCollection<FirestoreAttribute>(materialsQ);
  const patternsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'patterns') : null), [firestore]);
  const { data: patterns } = useCollection<FirestoreAttribute>(patternsQ);

  // Local draft state
  const buildDraftFromParams = React.useCallback(
    () => ({
      gender: searchParams.get('gender') ?? '',
      categoryId: searchParams.get('categoryId') ?? '',
      category: searchParams.get('category') ?? '',
      brand: searchParams.get('brand') ?? '',
      condition: searchParams.get('condition') ?? '',
      color: searchParams.get('color') ?? '',
      material: searchParams.get('material') ?? '',
      pattern: searchParams.get('pattern') ?? '',
      minPrice: searchParams.get('minPrice') ?? '',
      maxPrice: searchParams.get('maxPrice') ?? '',
    }),
    [searchParams],
  );
  const [draft, setDraft] = React.useState(buildDraftFromParams);

  React.useEffect(() => {
    if (open) setDraft(buildDraftFromParams());
  }, [open, buildDraftFromParams]);

  const set = (key: string, value: string) =>
    setDraft((d) => {
      const next = { ...d, [key]: d[key as keyof typeof d] === value ? '' : value };
      // Clearing or changing the parent category invalidates the active subcategory.
      if (key === 'categoryId' && next.categoryId !== d.categoryId) next.category = '';
      return next;
    });

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    const keys = ['gender', 'categoryId', 'category', 'brand', 'condition', 'color', 'material', 'pattern', 'minPrice', 'maxPrice'];
    keys.forEach((k) => {
      const v = draft[k as keyof typeof draft];
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`${pathname}?${params.toString()}`);
    onOpenChange(false);
  };

  const clearAll = () => {
    setDraft({ gender: '', categoryId: '', category: '', brand: '', condition: '', color: '', material: '', pattern: '', minPrice: '', maxPrice: '' });
  };

  // Parent categories registered in admin, sorted by admin order then name.
  const parentCategories = React.useMemo(() => {
    if (!allCategories) return [];
    return allCategories
      .filter((c) => !c.parentId && c.isActive !== false)
      .slice()
      .sort((a, b) => {
        const oa = a.order ?? 999;
        const ob = b.order ?? 999;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
  }, [allCategories]);

  // Subcategory groups, mirroring the sell-flow CategoryStep: each parent is a
  // heading, its subcategories listed underneath, sorted alphabetically. We
  // dedupe by slug so the same physical sub doesn't appear twice.
  const categoryGroups = React.useMemo(() => {
    if (!allCategories) return [] as { parent: FirestoreCategory; subs: FirestoreCategory[] }[];
    const seen = new Set<string>();
    return parentCategories
      .map((p) => ({
        parent: p,
        subs: allCategories
          .filter((c) => c.parentId === p.id && c.isActive !== false)
          .filter((c) => {
            if (!c.slug || seen.has(c.slug)) return false;
            seen.add(c.slug);
            return true;
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.subs.length > 0);
  }, [allCategories, parentCategories]);

  // Currently-picked subcategory record (for the accordion header summary).
  const pickedSubcategory = React.useMemo(() => {
    if (!draft.category) return undefined;
    for (const g of categoryGroups) {
      const found = g.subs.find((s) => s.slug === draft.category);
      if (found) return { sub: found, parent: g.parent };
    }
    return undefined;
  }, [categoryGroups, draft.category]);

  const sortedBrands = React.useMemo(
    () => (brands ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );
  const sortedConditions = React.useMemo(
    () => (conditions ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [conditions],
  );
  const sortedColors = React.useMemo(
    () => (colors ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [colors],
  );
  const sortedMaterials = React.useMemo(
    () => (materials ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  );
  const sortedPatterns = React.useMemo(
    () => (patterns ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [patterns],
  );

  // Per-section search inputs (only relevant for sections with many options).
  const [searchTerms, setSearchTerms] = React.useState<Record<string, string>>({});
  const sectionSearch = (section: string) => searchTerms[section] ?? '';
  const setSectionSearch = (section: string, value: string) =>
    setSearchTerms((prev) => ({ ...prev, [section]: value }));
  const matchesSearch = (label: string, term: string) =>
    !term || label.toLowerCase().includes(term.toLowerCase());

  // Default-open Gender; the rest collapsed so the sheet starts compact.
  const [openSections, setOpenSections] = React.useState<string[]>(['gender']);

  // Render helpers — defined as plain functions (not React components) so
  // they're inlined into the parent's element tree on each render. Defining
  // them as components inside FilterSheet would give them a new identity per
  // render, causing React to unmount and remount the inputs and lose focus
  // mid-typing.
  const renderPills = (
    options: { value: string; label: string }[],
    field: string,
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => set(field, o.value)}
          className={cn(
            'px-3 py-1.5 rounded-full border text-sm transition-colors',
            draft[field as keyof typeof draft] === o.value
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-foreground border-border hover:border-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const renderSearchInput = (section: string, placeholder: string) => (
    <div className="relative mb-3">
      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={sectionSearch(section)}
        onChange={(e) => setSectionSearch(section, e.target.value)}
        className="h-8 pl-8 text-xs"
      />
    </div>
  );

  const renderSectionTrigger = (label: string, summary?: string) => (
    <span className="flex w-full items-center justify-between pr-2">
      <span className="font-semibold text-sm">{label}</span>
      {summary && (
        <span className="text-xs font-normal text-muted-foreground truncate ml-2 max-w-[60%]">
          {summary}
        </span>
      )}
    </span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col rounded-t-2xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Filters</SheetTitle>
            <button onClick={clearAll} className="text-sm text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="w-full"
          >
            {/* Gender */}
            <AccordionItem value="gender">
              <AccordionTrigger className="py-3">
                {renderSectionTrigger('Gender', GENDERS.find((g) => g.value === draft.gender)?.label)}
              </AccordionTrigger>
              <AccordionContent>
                {renderPills(GENDERS, 'gender')}
              </AccordionContent>
            </AccordionItem>

            {/* Category — grouped by parent, same shape as the sell flow */}
            {categoryGroups.length > 0 && (
              <AccordionItem value="category">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Category',
                    pickedSubcategory
                      ? `${pickedSubcategory.parent.name} · ${pickedSubcategory.sub.name}`
                      : undefined,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderSearchInput('category', 'Search categories…')}
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                    {categoryGroups
                      .map((g) => ({
                        ...g,
                        matched: g.subs.filter(
                          (s) =>
                            matchesSearch(s.name, sectionSearch('category'))
                            || matchesSearch(g.parent.name, sectionSearch('category')),
                        ),
                      }))
                      .filter((g) => g.matched.length > 0)
                      .map((g) => (
                        <div key={g.parent.id} className="space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {g.parent.name}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {g.matched.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  // Picking a sub also locks the parent — mirrors the sell flow,
                                  // where the parent is implied by the chosen subcategory.
                                  set('category', s.slug);
                                  setDraft((d) => ({
                                    ...d,
                                    categoryId: d.category === s.slug ? '' : g.parent.slug,
                                  }));
                                }}
                                className={cn(
                                  'px-3 py-1.5 rounded-full border text-sm transition-colors',
                                  draft.category === s.slug
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-background text-foreground border-border hover:border-foreground',
                                )}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Brand */}
            {sortedBrands.length > 0 && (
              <AccordionItem value="brand">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Brand',
                    sortedBrands.find((b) => b.slug === draft.brand)?.name,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderSearchInput('brand', 'Search brands…')}
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {sortedBrands
                      .filter((b) => matchesSearch(b.name, sectionSearch('brand')))
                      .map((b) => (
                        <button
                          key={b.id}
                          onClick={() => set('brand', b.slug)}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-sm transition-colors',
                            draft.brand === b.slug
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-foreground border-border hover:border-foreground',
                          )}
                        >
                          {b.name}
                        </button>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Condition */}
            {sortedConditions.length > 0 && (
              <AccordionItem value="condition">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Condition',
                    sortedConditions.find((c) => c.value === draft.condition)?.name,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderPills(
                    sortedConditions.map((c) => ({ value: c.value, label: c.name })),
                    'condition',
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Color */}
            {sortedColors.length > 0 && (
              <AccordionItem value="color">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Color',
                    sortedColors.find((c) => c.value === draft.color)?.name,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderSearchInput('color', 'Search colors…')}
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {sortedColors
                      .filter((c) => matchesSearch(c.name, sectionSearch('color')))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => set('color', c.value)}
                          title={c.name}
                          className={cn(
                            'w-8 h-8 rounded-full border-2 transition-all',
                            draft.color === c.value
                              ? 'border-foreground scale-110 shadow-md'
                              : 'border-border',
                          )}
                          style={{ backgroundColor: c.hex ?? c.value }}
                        />
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Material */}
            {sortedMaterials.length > 0 && (
              <AccordionItem value="material">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Material',
                    sortedMaterials.find((m) => m.value === draft.material)?.name,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderSearchInput('material', 'Search materials…')}
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {sortedMaterials
                      .filter((m) => matchesSearch(m.name, sectionSearch('material')))
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => set('material', m.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-sm transition-colors',
                            draft.material === m.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-foreground border-border hover:border-foreground',
                          )}
                        >
                          {m.name}
                        </button>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Pattern */}
            {sortedPatterns.length > 0 && (
              <AccordionItem value="pattern">
                <AccordionTrigger className="py-3">
                  {renderSectionTrigger(
                    'Pattern',
                    sortedPatterns.find((p) => p.value === draft.pattern)?.name,
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {renderSearchInput('pattern', 'Search patterns…')}
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {sortedPatterns
                      .filter((p) => matchesSearch(p.name, sectionSearch('pattern')))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => set('pattern', p.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-sm transition-colors',
                            draft.pattern === p.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-foreground border-border hover:border-foreground',
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Price */}
            <AccordionItem value="price">
              <AccordionTrigger className="py-3">
                {renderSectionTrigger(
                  'Price (EUR)',
                  draft.minPrice || draft.maxPrice
                    ? `${draft.minPrice || '0'} – ${draft.maxPrice || '∞'}`
                    : undefined,
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    placeholder="€0"
                    value={draft.minPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))}
                    className="flex-1 h-10 rounded-md border border-border px-3 text-sm bg-background"
                    min={0}
                    max={priceRange?.max}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number"
                    placeholder={priceRange ? `€${priceRange.max}` : 'Max'}
                    value={draft.maxPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))}
                    className="flex-1 h-10 rounded-md border border-border px-3 text-sm bg-background"
                    min={0}
                    max={priceRange?.max}
                  />
                </div>
                {priceRange && priceRange.max > 0 && (
                  <Slider
                    className="mt-4"
                    min={0}
                    max={priceRange.max}
                    step={1}
                    value={[
                      Math.max(0, Number(draft.minPrice) || 0),
                      Math.min(priceRange.max, Number(draft.maxPrice) || priceRange.max),
                    ]}
                    onValueChange={([lo, hi]) =>
                      setDraft((d) => ({
                        ...d,
                        minPrice: lo === 0 ? '' : String(lo),
                        maxPrice: hi === priceRange.max ? '' : String(hi),
                      }))
                    }
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <SheetFooter className="px-4 pb-6 pt-2 border-t">
          <Button className="w-full" size="lg" onClick={applyFilters}>
            Show results
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Active filter pills ───────────────────────────────────────────────────────

function ActiveFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterKeys = ['gender', 'category', 'brand', 'condition', 'color', 'material', 'pattern', 'minPrice', 'maxPrice'];
  const active = filterKeys.filter((k) => searchParams.get(k));
  if (active.length === 0) return null;

  const remove = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {active.map((key) => (
        <Badge key={key} variant="secondary" className="gap-1 capitalize pl-2.5 pr-1 py-1">
          {key === 'minPrice' ? `From €${searchParams.get(key)}` :
           key === 'maxPrice' ? `To €${searchParams.get(key)}` :
           searchParams.get(key)!.replace(/-/g, ' ')}
          <button
            onClick={() => remove(key)}
            className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

// ─── Product list page ────────────────────────────────────────────────────────

function ProductListPage() {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const [filterOpen, setFilterOpen] = React.useState(false);
  const { brands, categories } = useAttributeData(firestore);

  const { products, isLoading, isLoadingMore, hasMore, loadMore, activeFilterCount } =
    useFilteredProducts(firestore, searchParams, brands, categories);

  // Actual price range across the currently-loaded products. Drives the
  // Price filter placeholders so users see real bounds instead of "Min/Max".
  const priceRange = React.useMemo(() => {
    if (products.length === 0) return undefined;
    let min = Infinity;
    let max = -Infinity;
    for (const p of products) {
      const v = typeof p.price === 'number' ? p.price : Number(p.price);
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [products]);

  const gender = searchParams.get('gender') ?? '';
  const category = searchParams.get('category') ?? '';
  const section = searchParams.get('section') ?? '';

  let title = 'All Products';
  if (section === 'new-arrivals') title = 'New Arrivals';
  else if (category) title = category.replace(/-/g, ' ');
  else if (gender) title = `${gender.charAt(0).toUpperCase() + gender.slice(1)}'s`;

  return (
    <div className="flex flex-col bg-background min-h-screen">
      <div className="container px-4 py-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl font-bold capitalize">{isLoading ? '…' : title}</h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {products.length}{hasMore ? '+' : ''} items
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => setFilterOpen(true)} className="shrink-0 relative">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <ActiveFilters />

        {isLoading ? (
          <Skeleton4 />
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-2">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{
                    id: p.id,
                    brandId: p.brandId,
                    title: p.title,
                    price: p.price,
                    images: p.images,
                    sellerId: p.sellerId,
                    size: p.size,
                    condition: p.condition,
                    color: p.color,
                    vintage: p.vintage,
                    status: p.status,
                  }}
                />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  className="rounded-full px-12"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold">No products found</h2>
            <p className="mt-2 text-muted-foreground">Try adjusting your filters.</p>
            <Button variant="outline" className="mt-4" onClick={() => setFilterOpen(true)}>
              Open filters
            </Button>
          </div>
        )}
      </div>

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} priceRange={priceRange} />
    </div>
  );
}

// ─── Search landing page ───────────────────────────────────────────────────────

function SearchLandingPage() {
  const router = useRouter();
  const [q, setQ] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <form onSubmit={handleSubmit} className="relative">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for items, brands, members…"
          className="w-full h-11 pl-4 pr-10 rounded-full border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </form>

      {/* Quick filters */}
      <div className="mt-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browse by gender</p>
        <div className="grid grid-cols-2 gap-3">
          {GENDERS.map((g) => (
            <Button
              key={g.value}
              variant="outline"
              className="h-12 text-base"
              onClick={() => router.push(`/search?gender=${g.value}`)}
            >
              {g.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function SearchPageContents() {
  const searchParams = useSearchParams();
  const hasQuery = Array.from(searchParams.keys()).length > 0;
  return hasQuery ? <ProductListPage /> : <SearchLandingPage />;
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <SearchPageContents />
    </React.Suspense>
  );
}
