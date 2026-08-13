'use client';

import { Suspense } from 'react';
import WebProfileOrdersPage from '@/app/profile/orders/[orderId]/client-page';

/**
 * Native stand-in for `/profile/orders/[orderId]`.
 *
 * A static export cannot emit a page per id, so the Capacitor bundle reaches
 * the very same component through a query string instead of a path segment.
 * `NativeRouteBridge` rewrites links to here automatically; `useRouteParam()`
 * inside the component reads the id from either shape. This file must not hold
 * any logic of its own — the web route is the single implementation.
 *
 * The Suspense boundary is required: the component reads `useSearchParams()`,
 * which a statically exported page may only do beneath one.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WebProfileOrdersPage />
    </Suspense>
  );
}
