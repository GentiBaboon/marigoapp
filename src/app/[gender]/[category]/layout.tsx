import type { Metadata } from 'next';
import { pageMetadata, noindexMetadata } from '@/lib/seo';
import { GENDER_LABELS, isGenderSegment, titleiseSlug } from '@/lib/category-url';

type Props = { params: { gender: string; category: string }; children: React.ReactNode };

export function generateMetadata({ params }: Props): Metadata {
  // See the note in ../layout.tsx — metadata runs even when the page 404s.
  if (!isGenderSegment(params.gender)) return noindexMetadata('Page not found | MarigoApp');

  const gender = params.gender;
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
