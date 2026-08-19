import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Help & FAQ | MarigoApp',
  description: 'Answers on buying, selling, authentication, delivery, returns and payments on MarigoApp.',
  path: '/help',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
