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

  // Only fetch active products, limited to top 100 by views (avoids downloading entire collection)
  const productsQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'products'),
      where('status', '==', 'active'),
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

  // Group products into displayable tabs
  const { tabs, grouped } = React.useMemo(() => {
    if (!products || products.length === 0) return { tabs: [], grouped: {} };

    // Resolve each product to a display category
    const productGroups: Record<string, FirestoreProduct[]> = {};
    const tabNames: Record<string, string> = {};

    products.forEach(product => {
      // Try categoryId, subcategoryId, or fallback
      const catId = product.categoryId || product.subcategoryId || '';

      if (!catId) {
        // No category assigned — group under "All"
        if (!productGroups['all']) productGroups['all'] = [];
        productGroups['all'].push(product);
        tabNames['all'] = 'All';
        return;
      }

      const cat = categoryMap[catId];
      if (cat) {
        // If it's a subcategory, group under parent
        const displayId = cat.parentId ? cat.parentId : cat.id;
        const displayName = cat.parentId && categoryMap[cat.parentId]
          ? categoryMap[cat.parentId].name
          : cat.name;

        if (!productGroups[displayId]) productGroups[displayId] = [];
        productGroups[displayId].push(product);
        tabNames[displayId] = displayName;
      } else {
        // Category ID exists but not in categories collection
        if (!productGroups[catId]) productGroups[catId] = [];
        productGroups[catId].push(product);
        tabNames[catId] = catId;
      }
    });

    // Sort tabs by product count, limit to 8
    const sortedTabs = Object.entries(productGroups)
      .filter(([, prods]) => prods.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([id]) => ({ id, name: tabNames[id] || id }));

    return { tabs: sortedTabs, grouped: productGroups };
  }, [products, categoryMap]);

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
            <TabsList className="mb-6 bg-transparent gap-1 h-auto flex-wrap">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-full border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4"
                >
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
                {grouped[tab.id]?.slice(0, 8).map(p => (
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
                    }}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  );
}
