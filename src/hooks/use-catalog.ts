'use client';

/**
 * Drop-in replacement for `useCollection(collection(firestore, '<catalog>'))`.
 *
 * Same shape as `useCollection` — `{ data, isLoading }` — so a call site
 * migrates by swapping the hook, not by restructuring the component. The
 * difference is what happens underneath: one cached `getDocs` per session
 * shared by every consumer, instead of a live listener per component.
 *
 * See `src/lib/catalog-cache.ts` for why, and for the staleness trade-off.
 */

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { loadCatalogCollection, type CatalogCollection } from '@/lib/catalog-cache';

export function useCatalog<T extends { id: string }>(name: CatalogCollection) {
  const firestore = useFirestore();
  const [data, setData] = React.useState<T[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    let cancelled = false;

    setIsLoading(true);
    loadCatalogCollection<T>(firestore, name)
      .then(docs => {
        if (!cancelled) setData(docs);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [firestore, name]);

  return { data, isLoading };
}

/** Several catalog collections at once, resolved in parallel. */
export function useCatalogs<T extends { id: string }>(names: CatalogCollection[]) {
  const firestore = useFirestore();
  const [data, setData] = React.useState<Partial<Record<CatalogCollection, T[]>>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Names are usually an inline array literal; key on contents so the effect
  // does not re-run on every render.
  const key = names.join(',');

  React.useEffect(() => {
    if (!firestore) return;
    let cancelled = false;
    const list = key.split(',').filter(Boolean) as CatalogCollection[];

    setIsLoading(true);
    Promise.all(list.map(n => loadCatalogCollection<T>(firestore, n).then(docs => [n, docs] as const)))
      .then(entries => {
        if (cancelled) return;
        setData(Object.fromEntries(entries) as Partial<Record<CatalogCollection, T[]>>);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [firestore, key]);

  return { data, isLoading };
}
