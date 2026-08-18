import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Search Luxury Fashion | MarigoApp',
  description: 'Search thousands of authenticated pre-owned luxury pieces by brand, size, colour, condition and price.',
  path: '/search',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
