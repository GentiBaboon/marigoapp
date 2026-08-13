/**
 * @fileOverview One shared, cached copy of the catalog reference data.
 *
 * ## Why
 *
 * `brands` (141), `categories` (127), `colors` (97), `materials` (107),
 * `patterns` (92), `conditions` (4) and `size_charts` (20) come to ~588
 * documents — more than twenty times the size of the product collection. They
 * are edited from the admin screens perhaps weekly.
 *
 * Every consumer used to open its own `useCollection` on them, which is a live
 * `onSnapshot` listener: each mount pays a full read of the result set, and the
 * listener stays open. `/search` mounted two listeners on `brands` and two on
 * `categories` in the same render, so a single visit read ~836 documents,
 * nearly all of it data that had not changed in days.
 *
 * This module fetches each collection **once per session** with `getDocs`,
 * shares the result across every component, and persists it to
 * `sessionStorage` so client-side navigation and reloads do not re-read it.
 *
 * ## Trade-off
 *
 * Catalog edits no longer appear live in an open tab; they appear on the next
 * session, or after `TTL_MS`. That is the right trade for reference data —
 * a shopper does not need a newly-added colour to stream in mid-visit. Data
 * that genuinely changes under the user (products, orders, messages,
 * notifications) still uses live listeners and must keep doing so.
 */

import {
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';

/** Collections safe to treat as slow-moving reference data. */
export type CatalogCollection =
  | 'brands'
  | 'categories'
  | 'colors'
  | 'materials'
  | 'conditions'
  | 'patterns'
  | 'size_charts';

/** How long a cached copy stays usable within a session. */
const TTL_MS = 30 * 60 * 1000;

const STORAGE_PREFIX = 'marigo_catalog_v1:';

interface Entry<T> {
  at: number;
  docs: T[];
}

/** Per-tab memory cache: avoids even the sessionStorage parse on re-render. */
const memory = new Map<CatalogCollection, Entry<any>>();
/** De-dupes concurrent first loads — several components mount in one tick. */
const inFlight = new Map<CatalogCollection, Promise<any[]>>();

function readSession<T>(name: CatalogCollection): Entry<T> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    return Array.isArray(parsed?.docs) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession<T>(name: CatalogCollection, entry: Entry<T>): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(entry));
  } catch {
    // Quota or private mode: the memory cache still does the heavy lifting.
  }
}

function isFresh(entry: Entry<unknown> | null): boolean {
  return !!entry && Date.now() - entry.at < TTL_MS;
}

/**
 * Fetch a catalog collection, from cache when possible.
 *
 * Returns `[]` rather than throwing when Firestore is unavailable — the
 * callers are pickers and filters, which degrade to "no options" far more
 * gracefully than to a crashed page.
 */
export async function loadCatalogCollection<T extends { id: string }>(
  firestore: Firestore,
  name: CatalogCollection,
): Promise<T[]> {
  const cached = (memory.get(name) as Entry<T> | undefined) ?? readSession<T>(name);
  if (isFresh(cached)) {
    memory.set(name, cached!);
    return cached!.docs;
  }

  const pending = inFlight.get(name);
  if (pending) return pending as Promise<T[]>;

  const load = (async () => {
    try {
      const snap = await getDocs(collection(firestore, name));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
      const entry: Entry<T> = { at: Date.now(), docs };
      memory.set(name, entry);
      writeSession(name, entry);
      return docs;
    } catch (error) {
      console.warn(`[catalog] failed to load ${name}:`, error);
      // Serve a stale copy over nothing — an expired list of brands is far
      // more useful than an empty picker.
      return (cached?.docs as T[]) ?? [];
    } finally {
      inFlight.delete(name);
    }
  })();

  inFlight.set(name, load);
  return load;
}

/**
 * Drop cached copies so the next read hits Firestore.
 * Call after an admin edits the catalog, so they see their own change.
 */
export function invalidateCatalog(name?: CatalogCollection): void {
  const names: CatalogCollection[] = name
    ? [name]
    : ['brands', 'categories', 'colors', 'materials', 'conditions', 'patterns', 'size_charts'];
  for (const n of names) {
    memory.delete(n);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + n);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
}
