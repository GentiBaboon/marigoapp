import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { GENDER_LABELS, isGenderSegment, titleiseSlug } from '@/lib/category-url';

type Props = { params: { gender: string; category: string }; children: React.ReactNode };

export function generateMetadata({ params }: Props): Metadata {
  const gender = isGenderSegment(params.gender) ? params.gender : 'women';
  const label = GENDER_LABELS[gender];
  const category = titleiseSlug(params.category);

  return pageMetadata({
    title: `${label} ${category} | Pre-Owned Luxury | MarigoApp`,
    description: `Shop authenticated pre-owned ${label.toLowerCase().replace(/'s$/, "'s")} ${category.toLowerCase()} on MarigoApp. Curated designer pieces, buyer protection and delivery across Albania, Italy and the EU.`,
    path: `/${params.gender}/${params.category}`,
  });
}

export default function Layout({ children }: Props) {
  return <>{children}</>;
}
