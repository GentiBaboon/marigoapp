'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { FirestoreCategory, FirestoreBrand } from '@/lib/types';

function ListItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between p-4 hover:bg-muted/50">
        <span className="text-base font-medium">{children}</span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    </li>
  );
}

export default function CategoryDetailPage() {
  const params = useParams();
  const [gender, categorySlug] = (params.slug as string[]) || [];
  const firestore = useFirestore();

  const categoriesQ = useMemoFirebase(
    () => (firestore ? collection(firestore, 'categories') : null),
    [firestore],
  );
  const { data: allCategories, isLoading: catsLoading } = useCollection<FirestoreCategory>(categoriesQ);

  const brandsQ = useMemoFirebase(
    () => (firestore ? collection(firestore, 'brands') : null),
    [firestore],
  );
  const { data: brands } = useCollection<FirestoreBrand>(brandsQ);

  const parentCategory = React.useMemo(
    () => allCategories?.find((c) => !c.parentId && c.slug === categorySlug),
    [allCategories, categorySlug],
  );

  const subcategories = React.useMemo(
    () => allCategories?.filter((c) => c.parentId === parentCategory?.id && c.isActive) ?? [],
    [allCategories, parentCategory],
  );

  const genderName = gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '';

  if (catsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!parentCategory) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p>Category not found.</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/browse">Go back to browse</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="container px-4 py-6 border-b">
        <h1 className="text-2xl font-bold">{parentCategory.name}</h1>
      </div>

      <ScrollArea className="flex-1">
        <ul className="bg-background">
          {/* All in this category */}
          <ListItem href={`/search?gender=${gender}&categoryId=${parentCategory.slug}`}>
            All {genderName}'s {parentCategory.name}
          </ListItem>
          <Separator />

          {/* Subcategories from Firestore */}
          {subcategories.map((sub, index) => (
            <React.Fragment key={sub.id}>
              <ListItem href={`/search?gender=${gender}&category=${sub.slug}`}>
                {sub.name}
              </ListItem>
              {index < subcategories.length - 1 && <Separator className="ml-4" />}
            </React.Fragment>
          ))}
        </ul>

        {brands && brands.length > 0 && (
          <>
            <div className="p-4 bg-muted/50 mt-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Top Brands</h2>
            </div>
            <ul className="bg-background">
              {brands.slice(0, 6).map((brand, index) => (
                <React.Fragment key={brand.id}>
                  <ListItem href={`/search?brand=${brand.slug}`}>
                    {brand.name}
                  </ListItem>
                  {index < Math.min(brands.length, 6) - 1 && <Separator className="ml-4" />}
                </React.Fragment>
              ))}
            </ul>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
