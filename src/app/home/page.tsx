'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { NewArrivalsSection } from '@/components/home/NewArrivalsSection';
import { RecentlyViewedSection } from '@/components/home/RecentlyViewedSection';
import { PersonalizedPicks } from '@/components/home/PersonalizedPicks';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { MacroFilters } from '@/components/home/MacroFilters';
import { HomepageBlocks } from '@/components/home/HomepageBlocks';
import { Skeleton } from '@/components/ui/skeleton';

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[3/4] w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col bg-background">
      <div className="container mx-auto px-4 pt-4">
        <Suspense fallback={null}>
          <MacroFilters />
        </Suspense>
      </div>

      <div className="bg-background border-b mt-4">
        <div className="container mx-auto px-4 py-6">
          <h2 className="text-2xl font-serif mb-2">First Time?</h2>
          <p className="text-muted-foreground">Shop: 15% off with code <span className="font-semibold text-foreground">WELCOME15</span>. Sell: No fees to start.*...</p>
          <Link href="#" className="flex items-center mt-2 font-semibold text-sm group text-primary">
            Get started
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 pb-8 md:py-12 space-y-6 md:space-y-12">

        <Suspense fallback={null}>
          <HomepageBlocks />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <PersonalizedPicks />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <CategoriesSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <RecentlyViewedSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <NewArrivalsSection />
        </Suspense>
      </div>
    </div>
  );
}
