'use client';

/**
 * Records and reads which products a shopper has looked at.
 *
 * ## Why this exists
 *
 * The homepage has had a "Last Viewed" section for a long time reading
 * `localStorage.marigo_recently_viewed` — but **nothing ever wrote that key**.
 * The product page bumps the listing's global `views` counter and stops there,
 * so the section had no data and silently rendered nothing.
 *
 * ## Where it is stored
 *
 * Signed-in shoppers get their history on their own user document, so it
 * follows them between phone and laptop. Everyone also gets a localStorage
 * copy, which is what makes the section work before sign-in and what avoids a
 * network round-trip on first paint.
 *
 * The history lives as an array field on `users/{uid}` rather than a
 * subcollection: existing security rules already let a user update their own
 * document, so this needs no rules change, and a capped list of ids is one
 * read instead of N.
 */

import * as React from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';

const STORAGE_KEY = 'marigo_recently_viewed';

/**
 * How many products to remember. Deliberately modest: this is a way back to
 * something you just saw, not a browsing archive, and the whole list is
 * rewritten on the user document each time.
 */
export const RECENTLY_VIEWED_LIMIT = 20;

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode — the signed-in copy still persists.
  }
}

/** Most-recent-first, no duplicates, capped. */
function promote(ids: string[], productId: string): string[] {
  return [productId, ...ids.filter(id => id !== productId)].slice(0, RECENTLY_VIEWED_LIMIT);
}

/**
 * Record that the signed-in (or anonymous) visitor opened a product.
 *
 * Safe to call on every product page render — it no-ops when the product is
 * already at the front of the list.
 */
export function useRecordProductView(productId: string | undefined | null) {
  const { user } = useUser();
  const firestore = useFirestore();

  React.useEffect(() => {
    if (!productId || typeof window === 'undefined') return;

    const current = readLocal();
    if (current[0] === productId) return; // already the most recent

    const next = promote(current, productId);
    writeLocal(next);

    // Best-effort mirror to the user document. A failed write costs the
    // cross-device copy, never the page the shopper is looking at.
    if (user && firestore) {
      updateDoc(doc(firestore, 'users', user.uid), { recentlyViewed: next })
        .catch(err => console.warn('recently-viewed sync failed:', err));
    }
  }, [productId, user, firestore]);
}

/**
 * The visitor's view history, newest first.
 *
 * Starts from the local copy so the section can render immediately, then folds
 * in the server copy for someone who browsed on another device. The two are
 * merged rather than one replacing the other: signing in on a new phone should
 * not erase what you just looked at on it.
 */
export function useRecentlyViewedIds() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [ids, setIds] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const local = readLocal();
    setIds(local);

    if (!user || !firestore) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    getDoc(doc(firestore, 'users', user.uid))
      .then(snap => {
        if (cancelled) return;
        const remote = snap.data()?.recentlyViewed;
        if (!Array.isArray(remote)) return;

        const merged = [...local, ...remote.filter((id: unknown) => typeof id === 'string')]
          .filter((id, i, all) => all.indexOf(id) === i)
          .slice(0, RECENTLY_VIEWED_LIMIT);
        setIds(merged);
      })
      .catch(() => {
        // Local history is still perfectly usable on its own.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, firestore]);

  return { ids, isLoading };
}
