import { Suspense } from 'react';
import ClientPage from './client-page';
import { nativeOnlyStaticParams, NATIVE_PLACEHOLDER } from '@/lib/platform/static-params';

/**
 * Server entry for this dynamic route.
 *
 * The screen is a client component in `client-page.tsx`: `output: 'export'`
 * requires every dynamic segment to export `generateStaticParams()`, and a file
 * cannot carry both that and `'use client'`.
 *
 * User ids are unbounded, so there is no real list to pre-render. The native
 * build emits one unreachable placeholder to satisfy the export check and
 * reaches the real screen through the flat `/view` sibling.
 */
export function generateStaticParams() {
  return nativeOnlyStaticParams({ id: NATIVE_PLACEHOLDER });
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientPage />
    </Suspense>
  );
}
