/**
 * Per-page metadata helpers.
 *
 * Why this exists: the root layout declared `alternates: { canonical: '/' }`,
 * and only `/products/[id]` ever overrode it. App Router merges metadata down
 * the tree, so /about, /help, /browse, /search, /terms, /privacy and /home all
 * shipped `<link rel="canonical" href="https://www.marigoapp.com/">` — every
 * content page told Google it was really the homepage. That is precisely the
 * "Duplicate without user-selected canonical" and "Alternate page with proper
 * canonical tag" pair reported in Search Console: Google honoured the tag,
 * treated the pages as duplicates of `/`, and dropped them from the index.
 *
 * Every indexable route now declares its own canonical through `pageMetadata`.
 * Routes that must never be indexed use `noindexMetadata`.
 */
import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

interface PageMetaArgs {
  title: string;
  description: string;
  /** Site-relative path, e.g. '/about'. Becomes the canonical URL. */
  path: string;
  /** Override when a page is a known duplicate of another URL (e.g. /home → /). */
  canonicalPath?: string;
  keywords?: string;
  images?: string[];
}

export function pageMetadata({
  title,
  description,
  path,
  canonicalPath,
  keywords,
  images,
}: PageMetaArgs): Metadata {
  const canonical = absoluteUrl(canonicalPath ?? path);
  const ogImages = (images ?? [absoluteUrl('/og-image.jpg')]).map((url) => ({
    url,
    width: 1200,
    height: 630,
  }));

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: ogImages,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images ?? [absoluteUrl('/og-image.jpg')],
    },
  };
}

/**
 * For routes that exist for the app shells or for signed-in users and must not
 * compete in search. Deliberately *not* paired with a robots.txt Disallow —
 * a blocked URL can still be indexed from inbound links, and Google can only
 * honour `noindex` on a page it is allowed to fetch.
 */
export function noindexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  };
}
