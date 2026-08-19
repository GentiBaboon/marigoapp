import { notFound } from 'next/navigation';
import { isGenderSegment } from '@/lib/category-url';
import { nativeOnlyStaticParams, NATIVE_PLACEHOLDER } from '@/lib/platform/static-params';
import { SearchResults } from '@/app/search/client-page';

/** `/women` — everything for one gender. See [category]/page.tsx. */
export function generateStaticParams() {
  return nativeOnlyStaticParams({ gender: NATIVE_PLACEHOLDER });
}

export default function Page({ params }: { params: { gender: string } }) {
  if (!isGenderSegment(params.gender)) notFound();
  return <SearchResults overrides={{ gender: params.gender }} />;
}
