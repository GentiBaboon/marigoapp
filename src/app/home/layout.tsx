import { pageMetadata } from '@/lib/seo';

// `/` is a splash that client-redirects here, so the two URLs serve the same
// homepage. Canonical points at `/` so Google consolidates them into the root
// domain rather than picking one arbitrarily, and /home is kept out of the
// sitemap for the same reason.
export const metadata = pageMetadata({
  title: 'MarigoApp | Luxury Fashion Marketplace for Albania & EU',
  description: 'Buy and sell authentic pre-owned luxury fashion. Curated designer bags, shoes, clothing and accessories, delivered across Albania, Italy and the EU.',
  path: '/home',
  canonicalPath: '/',
  keywords: 'luxury fashion albania, designer resale, pre-owned luxury, second hand designer, marigo',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
