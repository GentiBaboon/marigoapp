import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Download the Marigo App | iPhone & Android',
  description: 'Get the Marigo app for iPhone from the App Store or for Android from Google Play — shop and sell preloved fashion in Albania and Kosovo.',
  path: '/download',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
