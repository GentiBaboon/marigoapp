'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { browseBanners } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query as firestoreQuery } from 'firebase/firestore';
import type { FirestoreCategory } from '@/lib/types';

// Display order for top-level categories under Women & Men tabs.
// Categories are pulled from Firestore (admin-registered) and rendered in this order.
const WOMENS_MENS_ORDER = [
  'clothing',
  'bags',
  'accessories',
  'active-wear',
  'shoes',
  'jewellery-and-watches',
];

// Display order for top-level categories under Children tab.
const CHILDREN_ORDER = [
  'clothing-for-girls',
  'clothing-for-boys',
  'baby',
  'childrens-accessories',
  'childrens-shoes',
];

function orderedBySlugs(
  cats: FirestoreCategory[],
  slugOrder: string[],
): FirestoreCategory[] {
  const bySlug = new Map(cats.map(c => [c.slug.toLowerCase(), c]));
  return slugOrder
    .map(slug => bySlug.get(slug))
    .filter((c): c is FirestoreCategory => Boolean(c));
}

function CategoryList({ categories }: { categories: { name: string; href: string }[] }) {
  return (
    <ul className="bg-background">
      {categories.map((category, index) => (
        <li key={category.href}>
          <Link href={category.href} className="flex items-center justify-between p-4 hover:bg-muted/50">
            <span className="text-base font-medium">{category.name}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          {index < categories.length - 1 && <Separator className="ml-4" />}
        </li>
      ))}
    </ul>
  );
}

function BannerList() {
  return (
    <div className="space-y-4 px-4 py-8 bg-background">
      {browseBanners.map((banner) => {
        const imageData = PlaceHolderImages.find(p => p.id === banner.image);
        return (
          <Link href={banner.href} key={banner.id} className="block bg-muted/50 rounded-lg overflow-hidden">
            <div className="flex items-center">
              <div className="flex-1 p-6">
                <h3 className="font-serif text-2xl mb-1">{banner.title}</h3>
                {banner.description && <p className="text-sm text-muted-foreground">{banner.description}</p>}
              </div>
              <div className="relative w-32 h-32 flex-shrink-0">
                {imageData ? (
                  <Image
                    src={imageData.imageUrl}
                    alt={banner.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                    data-ai-hint={imageData.imageHint}
                  />
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const TabContent = ({ categories }: { categories: { name: string; href: string }[] }) => (
  <div className="mt-0">
    <CategoryList categories={categories} />
    <Separator />
    <BannerList />
  </div>
);

export default function BrowsePage() {
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(
    () => firestore ? firestoreQuery(collection(firestore, 'categories')) : null,
    [firestore]
  );
  const { data: allCategories } = useCollection<FirestoreCategory>(categoriesQuery);

  const { womenItems, menItems, childrenItems } = React.useMemo(() => {
    if (!allCategories) return { womenItems: [], menItems: [], childrenItems: [] };

    const topLevel = allCategories.filter(c => !c.parentId);
    const womenMen = orderedBySlugs(topLevel, WOMENS_MENS_ORDER);
    const childCats = orderedBySlugs(topLevel, CHILDREN_ORDER);

    return {
      womenItems: womenMen.map(c => ({ name: c.name, href: `/browse/womenswear/${c.slug}` })),
      menItems: womenMen.map(c => ({ name: c.name, href: `/browse/menswear/${c.slug}` })),
      childrenItems: childCats.map(c => ({ name: c.name, href: `/browse/children/${c.slug}` })),
    };
  }, [allCategories]);

  return (
    <div className="flex flex-col min-h-screen">
      <Tabs defaultValue="women" className="w-full flex-1 flex flex-col">
        <div className="sticky top-16 bg-background z-30 border-b">
          <TabsList className="grid w-full grid-cols-3 rounded-none h-12 bg-transparent p-0 border-none">
            <TabsTrigger value="women" className="h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary text-base text-muted-foreground">Women</TabsTrigger>
            <TabsTrigger value="men" className="h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary text-base text-muted-foreground">Men</TabsTrigger>
            <TabsTrigger value="children" className="h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary text-base text-muted-foreground">Children</TabsTrigger>
          </TabsList>
        </div>

        <div className="pb-16 md:pb-0">
          <TabsContent value="women">
            <TabContent categories={womenItems} />
          </TabsContent>
          <TabsContent value="men">
            <TabContent categories={menItems} />
          </TabsContent>
          <TabsContent value="children">
            <TabContent categories={childrenItems} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
