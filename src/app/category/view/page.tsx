'use client';

import { Suspense } from 'react';
import { useRouteParam } from '@/lib/platform/use-route-param';
import { SearchResults } from '@/app/search/client-page';

/**
 * Native stand-in for `/{gender}/{category}`.
 *
 * A static export cannot emit a page per category, so the Capacitor bundle
 * reaches the same results grid through query params instead of path segments.
 * `NativeRouteBridge` rewrites links here automatically. This file must not
 * hold any logic of its own — the web route is the single implementation.
 */
function CategoryView() {
  const gender = useRouteParam('gender') ?? '';
  const category = useRouteParam('category') ?? '';
  return <SearchResults overrides={{ gender, ...(category ? { category } : {}) }} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CategoryView />
    </Suspense>
  );
}
