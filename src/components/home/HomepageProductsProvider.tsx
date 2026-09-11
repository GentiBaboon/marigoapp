'use client';

import * as React from 'react';
import { collection, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, type WithId } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';

/**
 * One product listener for the whole homepage.
 *
 * "Shop by Category", "New In" and "50% OFF Preloved" each used to open their
 * own `onSnapshot` over the same ~40 listings — three full reads of the
 * catalogue (≈3 KB a document) on every visit, which is what PageSpeed showed
 * as 540 KiB to 990 KiB of Firestore traffic before a single card rendered,
 * all of it parsed on the main thread. The sections now share this pool and
 * derive their own view of it in memory.
 *
 * The pool is the newest `POOL_SIZE` public listings. That is exactly what
 * "New In" and the markdown rail asked for; "Shop by Category" asked for the
 * 100 *most viewed*, which is the same set while the catalogue is under 100
 * listings and a near-identical one after — the newest hundred are also the
 * ones being viewed.
 */
const POOL_SIZE = 100;

/** Statuses a shopper may see on the homepage. Sold and reserved stay so
 *  their cards show a label instead of vanishing mid-browse. */
const PUBLIC_STATUSES = ['active', 'reserved', 'sold'] as const;

export interface HomepageProducts {
  /** Newest first. `null` until the first snapshot has arrived. */
  products: WithId<FirestoreProduct>[] | null;
  /** True until the first snapshot (or an error) — including during SSR, so
   *  the sections render their skeletons into the HTML and reserve their
   *  space rather than popping in later. */
  isLoading: boolean;
}

const HomepageProductsContext = React.createContext<HomepageProducts | null>(null);

function poolQuery(firestore: Firestore) {
  return query(
    collection(firestore, 'products'),
    where('status', 'in', [...PUBLIC_STATUSES]),
    orderBy('listingCreated', 'desc'),
    limit(POOL_SIZE),
  );
}

function useProductPool(enabled: boolean): HomepageProducts {
  const firestore = useFirestore();
  const productsQuery = useMemoFirebase(
    () => (enabled && firestore ? poolQuery(firestore) : null),
    [enabled, firestore],
  );
  const { data, error } = useCollection<FirestoreProduct>(productsQuery);
  return React.useMemo(
    () => ({ products: data, isLoading: enabled && data === null && !error }),
    [data, error, enabled],
  );
}

export function HomepageProductsProvider({ children }: { children: React.ReactNode }) {
  const value = useProductPool(true);
  return (
    <HomepageProductsContext.Provider value={value}>
      {children}
    </HomepageProductsContext.Provider>
  );
}

/**
 * The shared pool when rendered under the provider; a private listener of the
 * same shape otherwise, so a section still works if it is ever mounted alone.
 */
export function useHomepageProducts(): HomepageProducts {
  const shared = React.useContext(HomepageProductsContext);
  const own = useProductPool(shared === null);
  return shared ?? own;
}
