'use client';

import * as React from 'react';

const STORAGE_KEY = 'marigo_recent_searches';
const MAX_ENTRIES = 8;
/** Fired after a write so every mounted instance in this tab re-reads. The
 *  native `storage` event only fires in *other* tabs. Mirrors the pattern in
 *  `use-shopping-preference.ts`. */
const CHANGE_EVENT = 'marigo:recent-searches-changed';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    // Corrupt or unavailable storage (private mode) — degrade to "no history".
    return [];
  }
}

function write(terms: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // Quota or private mode: history is a nicety, never block the search.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Locally stored search history for the search overlay. Kept in localStorage
 * (not Firestore) so it works for signed-out visitors and costs no reads.
 */
export function useRecentSearches() {
  const [terms, setTerms] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Deferred to an effect: localStorage isn't available during SSR, and
    // seeding state from it directly would break hydration.
    setTerms(read());

    const onChange = () => setTerms(read());
    window.addEventListener('storage', onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const add = React.useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    // Case-insensitive de-dupe, most recent first.
    const next = [trimmed, ...read().filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ENTRIES);
    write(next);
  }, []);

  const remove = React.useCallback((term: string) => {
    write(read().filter(t => t !== term));
  }, []);

  const clear = React.useCallback(() => write([]), []);

  return { terms, add, remove, clear };
}
