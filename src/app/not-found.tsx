import type { Metadata } from 'next';
import { noindexMetadata } from '@/lib/seo';
import { NotFoundState } from '@/components/not-found-state';

/**
 * Global 404, replacing Next's stock "404 | This page could not be found" —
 * which renders with no header, no footer and no way onward.
 *
 * Next serves this **at the requested URL with a 404 status**, which is what
 * Search Console wants to see. Redirecting to a `/404` page would return 200
 * for a URL that does not exist — a soft 404, and worse than the stock page.
 */
export const metadata: Metadata = noindexMetadata('Page not found | MarigoApp');

export default function NotFound() {
  return <NotFoundState variant="page" />;
}
