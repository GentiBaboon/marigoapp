import { Suspense } from 'react';
import UnsubscribeClient from './client-page';

/**
 * Wrapped in Suspense because the body reads `useSearchParams()` — without a
 * boundary the static export fails to prerender (CLAUDE.md §14). The token is
 * read on the client for the same reason: the `searchParams` prop is always
 * empty in an export.
 */
export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeClient />
    </Suspense>
  );
}
