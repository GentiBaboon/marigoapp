'use client';

import { Suspense } from 'react';
import WebAdminUserPage from '@/app/admin/users/[id]/client-page';

/**
 * Native stand-in for `/admin/users/[id]`.
 *
 * The static export cannot emit a page per id, so the Capacitor bundle reaches
 * the same component through `?id=` instead of a path segment.
 * `NativeRouteBridge` rewrites links here automatically and `useRouteParams()`
 * reads the id from either shape. No logic belongs in this file — the web route
 * is the single implementation.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WebAdminUserPage />
    </Suspense>
  );
}
