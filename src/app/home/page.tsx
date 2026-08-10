'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NewArrivalsSection } from '@/components/home/NewArrivalsSection';
import { RecentlyViewedSection } from '@/components/home/RecentlyViewedSection';
import { PersonalizedPicks } from '@/components/home/PersonalizedPicks';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { MacroFilters } from '@/components/home/MacroFilters';
import { HomepageBlocks } from '@/components/home/HomepageBlocks';
import { MacroFilteredProducts } from '@/components/home/MacroFilteredProducts';
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

function HomePageContent() {
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('macroFilter');

  return (
    <div className="flex flex-col bg-background">
      <div className="container mx-auto px-4 pt-4">
        <Suspense fallback={null}>
          <MacroFilters />
        </Suspense>
      </div>

      {activeFilter ? (
        <div className="container mx-auto px-4 pt-6 pb-8 md:py-12">
          <Suspense fallback={<SectionSkeleton />}>
            <MacroFilteredProducts filterId={activeFilter} />
          </Suspense>
        </div>
      ) : (
        <>
          {/* The "First Time?" promo now lives in <AnnouncementBar /> above the
              header, so it is not repeated here. */}
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
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
