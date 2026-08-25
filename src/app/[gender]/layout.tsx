import type { Metadata } from 'next';
import { pageMetadata, noindexMetadata } from '@/lib/seo';
import { GENDER_LABELS, isGenderSegment } from '@/lib/category-url';

type Props = { params: { gender: string }; children: React.ReactNode };

export function generateMetadata({ params }: Props): Metadata {
  // The page calls notFound() for a segment that is not a gender, but a
  // layout's metadata is resolved regardless — so defaulting to 'women' here
  // titled every unmatched top-level URL "Women's Pre-Owned Luxury Fashion".
  if (!isGenderSegment(params.gender)) return noindexMetadata('Page not found | MarigoApp');

  const gender = params.gender;
  const label = GENDER_LABELS[gender];

  return pageMetadata({
    title: `${label} Pre-Owned Luxury Fashion | MarigoApp`,
    description: `Browse authenticated ${label.toLowerCase()} designer bags, shoes, clothing and accessories on MarigoApp, delivered across Albania, Italy and the EU.`,
    path: `/${params.gender}`,
  });
}

export default function Layout({ children }: Props) {
  return <>{children}</>;
}
