'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { browseBanners, browseCategories } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Separator } from '@/components/ui/separator';

function CategoryList({ categories }: { categories: { name: string; href: string }[] }) {
  return (
    <ul className="bg-background">
      {categories.map((category, index) => (
        <li key={category.name}>
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
                                {banner.id === 'new-arrivals' ? (
                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-neutral-800 to-black">
                                        <span className="font-bold text-3xl text-white tracking-widest">NEW</span>
                                    </div>
                                ) : imageData ? (
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
                )
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
                <TabContent categories={browseCategories.women} />
            </TabsContent>
            <TabsContent value="men">
                <TabContent categories={browseCategories.men} />
            </TabsContent>
            <TabsContent value="children">
                <TabContent categories={browseCategories.children} />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
