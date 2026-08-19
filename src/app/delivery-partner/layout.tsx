import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Become a Delivery Partner | MarigoApp',
  description: 'Earn on your own schedule delivering luxury fashion orders across Albania as a MarigoApp courier partner.',
  path: '/delivery-partner',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
