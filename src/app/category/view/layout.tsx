import { noindexMetadata } from '@/lib/seo';

// Flat stand-in for the clean category routes, emitted only so the Capacitor
// static export has a page to land on. On the web it duplicates /{gender}/
// {category}, so it must never be indexed.
export const metadata = noindexMetadata('MarigoApp Category');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
