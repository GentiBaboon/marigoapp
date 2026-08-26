import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'About MarigoApp | Fashion Marketplace for Albania & Kosovo',
  // Albania and Kosovo, not "Italy and the wider EU": those are the only two
  // countries the address book and the delivery pricing actually cover, so
  // claiming Europe set an expectation checkout cannot meet.
  description: 'Marigo is a fashion marketplace for Albania and Kosovo — sustainable choices, a more personal way to shop, and payment held until your item arrives.',
  path: '/about',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
