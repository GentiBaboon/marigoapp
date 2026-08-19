import { Suspense } from 'react';
import ClientPage from './client-page';
import { nativeOnlyStaticParams, NATIVE_PLACEHOLDER } from '@/lib/platform/static-params';

/**
 * Server entry for this dynamic route.
 *
 * The screen itself is a client component in `client-page.tsx`. It lives there
 * because `output: 'export'` requires every dynamic segment to export
 * `generateStaticParams()`, and Next forbids a file from carrying both that
 * export and the `'use client'` directive.
 *
 * Product, order and conversation ids are unbounded, so there is no real list
 * to pre-render. The native build emits one unreachable placeholder purely to
 * satisfy the export check and reaches the real screen through its flat `/view`
 * sibling (see `lib/platform/routes.ts`); the web build returns nothing here and
 * renders every id on demand, exactly as before.
 */
export function generateStaticParams() {
  return nativeOnlyStaticParams({ id: NATIVE_PLACEHOLDER, offerId: NATIVE_PLACEHOLDER });
}

export default function Page() {
  // Required, not decorative: the screen reads `useSearchParams()` through
  // `useRouteParam()`, which a statically exported page may only do beneath a
  // Suspense boundary.
  return (
    <Suspense fallback={null}>
      <ClientPage />
    </Suspense>
  );
}
