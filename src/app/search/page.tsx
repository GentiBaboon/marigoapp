'use client';

import SearchClientPage from './client-page';

/**
 * `/search` — the query-string form, used by the search box and the filter
 * sheet. The same results component also backs the clean category routes
 * (`/women/shirts`), which inject their filters as props instead. See
 * src/app/[gender]/[category]/page.tsx.
 */
export default function Page() {
  return <SearchClientPage />;
}
