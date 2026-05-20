'use client';

import * as React from 'react';

const STORAGE_KEY = 'marigo_shopping_preference';

/** Maps the modal's choice id (`womenswear` / `menswear`) to the value
 *  stored on product docs (`women` / `men`) so it can be used in
 *  `where('gender', '==', ...)` clauses. Unknown values return null. */
export function preferenceToGender(pref: string | null | undefined): 'women' | 'men' | null {
  if (pref === 'womenswear') return 'women';
  if (pref === 'menswear') return 'men';
  return null;
}

/**
 * Reads the user's saved shopping preference from localStorage and re-renders
 * when it changes (in the current tab or another tab). Returns the canonical
 * gender value (`'women' | 'men' | null`) ready to drop into Firestore where()
 * clauses or query strings.
 */
export function useShoppingPreference(): 'women' | 'men' | null {
  const [raw, setRaw] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Initial read (must happen client-side; localStorage isn't available during SSR).
    setRaw(typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null);

    if (typeof window === 'undefined') return;

    // Cross-tab + cross-component updates. Listen to native `storage` (other
    // tabs) plus a custom `marigo:preference-changed` event that the modal
    // dispatches after writing, so the current tab re-renders too.
    const onChange = () => {
      setRaw(window.localStorage.getItem(STORAGE_KEY));
    };
    window.addEventListener('storage', onChange);
    window.addEventListener('marigo:preference-changed', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('marigo:preference-changed', onChange);
    };
  }, []);

  return preferenceToGender(raw);
}
