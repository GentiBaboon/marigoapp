import type { Metadata } from 'next';
import { noindexMetadata } from '@/lib/seo';

/**
 * Never indexed. The URL carries a token identifying one person's mailbox, so
 * it must not end up in a search index — but it is deliberately left crawlable
 * rather than blocked in robots.txt, because `noindex` only works on a page
 * the crawler is allowed to fetch (CLAUDE.md §9).
 */
export const metadata: Metadata = noindexMetadata('Email preferences');

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
