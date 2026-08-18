import { noindexMetadata } from '@/lib/seo';

// Flat stand-in for a dynamic route, emitted only so the Capacitor static
// export has a page to land on. On the web it duplicates the real path-based
// route, so it must never be indexed. Crawlable on purpose: a URL blocked in
// robots.txt can still be indexed from a link, and Google can only honour
// `noindex` on a page it is allowed to fetch.
export const metadata = noindexMetadata('MarigoApp/admin/products');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
