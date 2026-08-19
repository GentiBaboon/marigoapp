import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { GENDER_LABELS, isGenderSegment } from '@/lib/category-url';

type Props = { params: { gender: string }; children: React.ReactNode };

export function generateMetadata({ params }: Props): Metadata {
  const gender = isGenderSegment(params.gender) ? params.gender : 'women';
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
