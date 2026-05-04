'use client';

import * as React from 'react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct, FirestoreCategory } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ProductCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
}

export function CategoriesSection() {
  const firestore = useFirestore();

  const categoriesQuery = useMemoFirebase(
    () => collection(firestore, 'categories'),
    [firestore]
  );
  const { data: categories, isLoading: categoriesLoading } = useCollection<FirestoreCategory>(categoriesQuery);

  // Top 100 by views. Include reserved alongside active so shoppers see them
  // labelled "Reserved" instead of vanishing from category tabs.
  const productsQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'products'),
      where('status', 'in', ['active', 'reserved']),
      orderBy('views', 'desc'),
      limit(100)
    ),
    [firestore]
  );
  const { data: products, isLoading: productsLoading } = useCollection<FirestoreProduct>(productsQuery);

  // Build category lookup
  const categoryMap = React.useMemo(() => {
    const map: Record<string, FirestoreCategory> = {};
    categories?.forEach(cat => { map[cat.id] = cat; });
    return map;
  }, [categories]);

  // Resolve a product → its display parent category id+name.
  // Subcategories roll up to their parent. Returns null for products whose
  // categoryId/subcategoryId can't be matched to a registered Firestore
  // category — those are excluded from the homepage tabs entirely.
  const resolveDisplayCategory = React.useCallback(
    (product: FirestoreProduct): { id: string; name: string } | null => {
      const rawIds = [product.categoryId, product.subcategoryId].filter(Boolean) as string[];
      if (rawIds.length === 0) return null;

      const allCats = Object.values(categoryMap);

      for (const raw of rawIds) {
        const lower = raw.toLowerCase();
        const cat =
          categoryMap[raw]
          ?? allCats.find(c => c.slug?.toLowerCase() === lower)
          ?? allCats.find(c => c.name?.toLowerCase() === lower);
        if (cat) {
          const parent = cat.parentId ? categoryMap[cat.parentId] : cat;
          return parent
            ? { id: parent.id, name: parent.name }
            : { id: cat.id, name: cat.name };
        }
      }
      return null;
    },
    [categoryMap],
  );

  // Build tabs from ALL admin-enabled parent categories.
  // Sort: most-used first (sum of product views), then the rest in admin
  // `order`, then alphabetic. Each tab still surfaces its products on click.
  const { tabs, grouped } = React.useMemo(() => {
    const productGroups: Record<string, FirestoreProduct[]> = {};
    const totalViews: Record<string, number> = {};

    (products ?? []).forEach(product => {
      const resolved = resolveDisplayCategory(product);
      if (!resolved) return;
      const { id } = resolved;
      if (!productGroups[id]) productGroups[id] = [];
      productGroups[id].push(product);
      totalViews[id] = (totalViews[id] ?? 0) + (product.views ?? 0);
    });

    const visibleParents = (categories ?? []).filter(
      c => !c.parentId && c.isActive !== false && c.homepageVisible !== false,
    );

    const sortedTabs = visibleParents
      .slice()
      .sort((a, b) => {
        const va = totalViews[a.id] ?? 0;
        const vb = totalViews[b.id] ?? 0;
        if (vb !== va) return vb - va;
        const oa = a.order ?? 999;
        const ob = b.order ?? 999;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      })
      .map(c => ({ id: c.id, name: c.name }));

    return { tabs: sortedTabs, grouped: productGroups };
  }, [products, categories, resolveDisplayCategory]);

  const isLoading = categoriesLoading || productsLoading;

  if (!isLoading && tabs.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl md:text-2xl font-serif mb-6">Shop by Category</h2>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
            {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <Tabs defaultValue={tabs[0]?.id}>
          <ScrollArea>
            <TabsList className="mb-6 bg-transparent gap-1 h-auto w-max flex-nowrap">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="shrink-0 rounded-full border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4"
                >
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {tabs.map(tab => {
            const items = grouped[tab.id]?.slice(0, 8) ?? [];
            return (
              <TabsContent key={tab.id} value={tab.id}>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No items in {tab.name} yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
                    {items.map(p => (
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
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
