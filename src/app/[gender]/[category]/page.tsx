import { notFound } from 'next/navigation';
import { isGenderSegment } from '@/lib/category-url';
import { nativeOnlyStaticParams, NATIVE_PLACEHOLDER } from '@/lib/platform/static-params';
import { SearchResults } from '@/app/search/client-page';

/**
 * `/women/shirts` — a category landing page.
 *
 * A server component so the filters come from the path, which is what lets the
 * sibling layout emit a real canonical and title. The results grid is the very
 * same component `/search` renders; only the filter source differs.
 */
export function generateStaticParams() {
  return nativeOnlyStaticParams({ gender: NATIVE_PLACEHOLDER, category: NATIVE_PLACEHOLDER });
}

export default function Page({ params }: { params: { gender: string; category: string } }) {
  // This route sits at the root, so an unmatched top-level path lands here.
  // Anything that is not a real gender is a 404, not an empty product grid.
  if (!isGenderSegment(params.gender)) notFound();

  return <SearchResults overrides={{ gender: params.gender, category: params.category }} />;
}
