'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard, toCardProduct } from '@/components/product-card';
import type { FirestoreProduct } from '@/lib/types';
import { Compass } from 'lucide-react';

/**
 * The dead end, made useful.
 *
 * Both of these used to be walls: Next's stock "404 | This page could not be
 * found" on a bad URL, and a bare line of text on a listing that is no longer
 * public. Neither carries the site's chrome, so the visitor's only move is the
 * back button — on a marketplace that is a lost session, and often a lost
 * customer who arrived from search on a listing that has since sold.
 *
 * So: say plainly what happened, then keep them shopping. Category shortcuts
 * for direction, and real listings underneath so there is something to click.
 */

export type NotFoundVariant = 'page' | 'listing-unavailable' | 'listing-sold';

const COPY: Record<NotFoundVariant, { heading: string; body: string }> = {
  page: {
    heading: "We can't find that page",
    body: 'The link may be out of date, or the address slightly off. Everything below is still here.',
  },
  // Deliberately vague about *why*. Drafts, items pending review and listings
  // pulled for a policy reason all land here, and none of those are the
  // visitor's business.
  'listing-unavailable': {
    heading: "This listing isn't available",
    body: 'It may have been removed, or it is not published yet. Here are other pieces you might like.',
  },
  'listing-sold': {
    heading: 'This piece has found a new home',
    body: 'One-of-a-kind items go quickly. Here is what else is available right now.',
  },
};

/** Where to send someone who has nothing else to click. */
const SHORTCUTS: Array<{ label: string; href: string }> = [
  { label: 'Women', href: '/women' },
  { label: 'Men', href: '/men' },
  { label: 'Bags', href: '/browse/bags' },
  { label: 'Shoes', href: '/browse/shoes' },
  { label: 'New in', href: '/search?section=new' },
];

function SuggestionsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Newest listings that can actually be bought — a rail of sold-out items on a
 *  dead end would be its own small insult. */
function Suggestions() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'products'),
            where('status', '==', 'active'),
            orderBy('listingCreated', 'desc'),
            limit(8),
          )
        : null,
    [firestore],
  );
  const { data: products, isLoading } = useCollection<FirestoreProduct>(productsQuery);

  if (isLoading) return <SuggestionsSkeleton />;
  if (!products?.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
      {products.slice(0, 4).map((p) => (
        <ProductCard key={p.id} product={toCardProduct(p)} />
      ))}
    </div>
  );
}

export function NotFoundState({
  variant = 'page',
  showSuggestions = true,
}: {
  variant?: NotFoundVariant;
  showSuggestions?: boolean;
}) {
  const { heading, body } = COPY[variant];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>

        <div className="mt-7 flex justify-center">
          {/* White on `--primary` is an explicit design choice, not the token
              default: `--primary-foreground` is near-black because the brand
              purple only reaches 2.74:1 against white, below the 4.5:1 WCAG AA
              needs for text this size. Kept per request — raise the swatch to
              a deeper purple if that ratio matters later. */}
          <Button asChild className="text-white hover:text-white">
            <Link href="/">
              <Compass className="mr-2 h-4 w-4" />
              Continue shopping
            </Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {showSuggestions && (
        <section className="mt-14">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Just in
          </h2>
          <Suggestions />
        </section>
      )}
    </div>
  );
}
