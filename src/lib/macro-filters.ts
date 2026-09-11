/**
 * @fileOverview The homepage filter chips' data, readable on the server.
 *
 * Same shape and reasons as `homepage-blocks.ts`: `settings/macro_filters` is
 * public-read, and the chips sit *above* the hero. Rendered client-side they
 * appeared only after Firestore answered, pushing the hero (the LCP element)
 * down by a full row after it had painted. Reading them on the server puts
 * the row in the first HTML, so nothing above the hero moves.
 */

import { hasFirestoreRestConfig, readDocument } from '@/lib/firestore-rest';
import { IS_NATIVE_BUILD } from '@/lib/platform/native';
import { HOMEPAGE_BLOCKS_REVALIDATE_SECONDS } from '@/lib/homepage-blocks';

export interface MacroFilter {
  id: string;
  label: string;
  enabled: boolean;
  productIds: string[];
  memberIds: string[];
}

export interface MacroFiltersConfig {
  filters: MacroFilter[];
}

/** The chips an admin has switched on, in stored order. */
export function enabledFilters(filters: readonly MacroFilter[] | null | undefined): MacroFilter[] {
  return (filters ?? []).filter((f) => f && f.enabled);
}

/** `null` — never a throw — when the read is unavailable; the browser
 *  listener fills the row in as before. */
export async function fetchMacroFilters(): Promise<MacroFilter[] | null> {
  if (IS_NATIVE_BUILD || !hasFirestoreRestConfig()) return null;
  try {
    const doc = await readDocument('settings/macro_filters', {
      next: { revalidate: HOMEPAGE_BLOCKS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    const filters = doc?.filters;
    if (!Array.isArray(filters)) return null;
    return enabledFilters(filters as MacroFilter[]);
  } catch (error) {
    console.warn('[macro-filters] server read failed; the browser will load the chips', error);
    return null;
  }
}
