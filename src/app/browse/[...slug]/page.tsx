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
  const segments = (params.slug as string[]) || [];
  // Routes can be /browse/{gender}/{slug} (e.g. /browse/womenswear/clothing)
  // or /browse/{slug} for gender-neutral categories (e.g. /browse/beauty-and-skincare).
  const genderSlug = segments.length >= 2 ? segments[0] : '';
  const categorySlug = segments.length >= 2 ? segments[1] : segments[0];

  // Browse URLs use display-friendly slugs (womenswear/menswear) but products
  // store the schema gender values (women/men/children/unisex). Map both ways.
  // For children we leave display empty — parent category names like
  // "Clothing for Girls" or "Children's Shoes" already imply the gender, so
  // prefixing "Children's" reads redundantly ("All Children's Baby").
  const GENDER_MAP: Record<string, { value: string; display: string }> = {
    womenswear: { value: 'women', display: "Women's" },
    menswear: { value: 'men', display: "Men's" },
    children: { value: 'children', display: '' },
  };
  const genderInfo = GENDER_MAP[genderSlug];
  const gender = genderInfo?.value ?? '';
  const genderDisplay = genderInfo?.display ?? '';

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
    () =>
      (allCategories?.filter(
        (c) => c.parentId === parentCategory?.id && c.isActive !== false,
      ) ?? [])
        .slice()
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [allCategories, parentCategory],
  );

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
          <ListItem
            href={
              gender
                ? `/search?gender=${gender}&categoryId=${parentCategory.slug}`
                : `/search?categoryId=${parentCategory.slug}`
            }
          >
            {genderDisplay
              ? `All ${genderDisplay} ${parentCategory.name}`
              : `All ${parentCategory.name}`}
          </ListItem>
          <Separator />

          {/* Subcategories from Firestore */}
          {subcategories.map((sub, index) => (
            <React.Fragment key={sub.id}>
              <ListItem
                href={
                  gender
                    ? `/search?gender=${gender}&category=${sub.slug}`
                    : `/search?category=${sub.slug}`
                }
              >
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
