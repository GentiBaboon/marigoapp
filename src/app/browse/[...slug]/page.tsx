'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { productCategories, brands } from '@/lib/mock-data';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const categoryData = React.useMemo(() => {
    return productCategories.find(c => c.name.toLowerCase() === categorySlug?.toLowerCase());
  }, [categorySlug]);

  const topBrands = React.useMemo(() => {
    // Just show a few top brands for demonstration
    return brands.filter(b => ['Chanel', 'Hermès', 'Louis Vuitton', 'Gucci'].includes(b.name));
  }, []);

  const genderName = gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '';

  if (!categoryData) {
    // This could also be a different page if the slug doesn't match the pattern.
    // For now, simple not found.
    return (
      <div className="container mx-auto py-8 text-center">
        <p>Category not found.</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/browse">Go back to browse</Link>
        </Button>
      </div>
    );
  }

  const categoryName = categoryData.name;
  
  return (
    <div className="flex flex-col h-full">
       <div className="container px-4 py-6 border-b">
        <h1 className="text-2xl font-bold">{categoryName}</h1>
      </div>

      <ScrollArea className="flex-1">
         <ul className="bg-background">
          <ListItem href={`/search?gender=${gender}&category=${categorySlug}`}>
            All {genderName}'s {categoryName}
          </ListItem>
          <Separator />
          {categoryData.subcategories.map((sub, index) => (
            <React.Fragment key={sub.slug}>
              <ListItem href={`/search?gender=${gender}&category=${sub.slug}`}>
                {sub.name}
              </ListItem>
              {index < categoryData.subcategories.length -1 && <Separator className="ml-4" />}
            </React.Fragment>
          ))}
        </ul>

        <div className="p-4 bg-muted/50 mt-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Top Brands</h2>
        </div>
        
        <ul className="bg-background">
             {topBrands.map((brand, index) => (
                <React.Fragment key={brand.slug}>
                    <ListItem href={`/search?brand=${brand.slug}`}>
                        {brand.name}
                    </ListItem>
                    {index < topBrands.length - 1 && <Separator className="ml-4" />}
                </React.Fragment>
             ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
