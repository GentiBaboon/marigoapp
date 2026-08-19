import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'About MarigoApp | Authentic Luxury Resale in Albania',
  description: 'MarigoApp is a curated marketplace for authentic pre-owned luxury fashion, connecting buyers and sellers across Albania, Italy and the wider EU.',
  path: '/about',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
