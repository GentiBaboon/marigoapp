import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Browse Luxury Fashion | MarigoApp',
  description: 'Browse authenticated pre-owned designer bags, shoes, clothing and accessories by category, brand and price.',
  path: '/browse',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
