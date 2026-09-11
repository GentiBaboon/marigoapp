'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NewArrivalsSection } from '@/components/home/NewArrivalsSection';
import { RecentlyViewedSection } from '@/components/home/RecentlyViewedSection';
import { PersonalizedPicks } from '@/components/home/PersonalizedPicks';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { DiscountedSection } from '@/components/home/DiscountedSection';
import { FavoritesSection } from '@/components/home/FavoritesSection';
import { MacroFilters } from '@/components/home/MacroFilters';
import { HomepageBlocks } from '@/components/home/HomepageBlocks';
import { HomepageProductsProvider } from '@/components/home/HomepageProductsProvider';
import { MacroFilteredProducts } from '@/components/home/MacroFilteredProducts';
import { Skeleton } from '@/components/ui/skeleton';
import type { HomepageBlock } from '@/lib/homepage-blocks';
import type { MacroFilter } from '@/lib/macro-filters';

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

interface HomeProps {
  /** The hero, read on the server so it is in the first HTML. */
  initialBlocks?: HomepageBlock[] | null;
  /** The filter chips, read on the server for the same reason. */
  initialFilters?: MacroFilter[] | null;
}

/**
 * Reports `?macroFilter=` to the page without suspending the page.
 *
 * `useSearchParams()` in a statically prerendered route makes Next render the
 * nearest Suspense fallback *instead of* the subtree that called it. When
 * `HomePageContent` called it directly, that boundary was the one wrapping
 * the whole page — so the prerendered HTML on Vercel held no hero at all,
 * while `npm run dev` (which renders per request) showed it fine. Reading
 * the param in this leaf keeps the bail-out to an empty component; the page
 * renders the default stack on the server and swaps to the filtered view
 * once this reports a value.
 */
function MacroFilterSync({ onChange }: { onChange: (filterId: string | null) => void }) {
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('macroFilter');
  React.useEffect(() => {
    onChange(activeFilter);
  }, [activeFilter, onChange]);
  return null;
}

function HomePageContent({ initialBlocks, initialFilters }: HomeProps) {
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col bg-background">
      <Suspense fallback={null}>
        <MacroFilterSync onChange={setActiveFilter} />
      </Suspense>
      <div className="container mx-auto px-4 pt-2">
        <MacroFilters activeFilter={activeFilter} initialFilters={initialFilters} />
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
          <div className="container mx-auto px-4 pt-2 pb-8 md:pt-4 md:pb-12 space-y-6 md:space-y-12">
            <Suspense fallback={null}>
              <HomepageBlocks initialBlocks={initialBlocks} />
            </Suspense>

            {/* One Firestore listener feeds the three catalogue sections. */}
            <HomepageProductsProvider>
              <Suspense fallback={<SectionSkeleton />}>
                <CategoriesSection />
              </Suspense>
              <Suspense fallback={<SectionSkeleton />}>
                <NewArrivalsSection />
              </Suspense>
              <Suspense fallback={<SectionSkeleton />}>
                <DiscountedSection />
              </Suspense>
            </HomepageProductsProvider>
            {/* The two personal rails close the page: both are ways back to
                something the shopper already chose, so they sit below
                everything still being discovered. Each renders nothing when
                empty, so a new visitor never sees a bare heading. */}
            <Suspense fallback={<SectionSkeleton />}>
              <FavoritesSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
              <PersonalizedPicks />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
              <RecentlyViewedSection />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The homepage body. Rendered by both `/` and `/home` (`page.tsx` beside this
 * file and `src/app/page.tsx`), which are the same page under two URLs — the
 * canonical is `/`.
 */
export function HomeClient({ initialBlocks = null, initialFilters = null }: HomeProps) {
  return <HomePageContent initialBlocks={initialBlocks} initialFilters={initialFilters} />;
}
