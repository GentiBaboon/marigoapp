/**
 * @fileOverview The editorial hero's data, readable on the server.
 *
 * `settings/homepage_blocks` is public-read, so the server can fetch it over
 * the Firestore REST API with the web API key and render the hero into the
 * HTML. Before this the hero only existed once the browser had booted the
 * Firebase SDK and opened a listener — PageSpeed measured a 6-second
 * "resource load delay" on the LCP image, and on desktop the hero arriving
 * late pushed the whole page down for a CLS of 0.82.
 *
 * The client component (`HomepageBlocks`) still subscribes live and takes
 * over the moment the document arrives, so an admin edit is visible at once
 * in an open tab; the server copy is only the first paint.
 */

import { hasFirestoreRestConfig, readDocument } from '@/lib/firestore-rest';
import { IS_NATIVE_BUILD } from '@/lib/platform/native';

export interface BlockImage {
  url: string;
  x: number;
  y: number;
}

export interface HomepageBlock {
  id: string;
  images?: BlockImage[];
  title?: string;
  subtitle?: string;
  /** Button text; rendered upper-case. Defaults to "Shop now". */
  ctaLabel?: string;
  url: string;
  visible: boolean;
  order: number;
  // legacy
  imageUrl?: string;
  text?: string;
}

export interface HomepageBlocksConfig {
  blocks: HomepageBlock[];
}

export const DEFAULT_BLOCK_CTA = 'Shop now';

/** How long a server-rendered copy of the hero may be served before it is
 *  refreshed. The live listener in the browser hides any staleness. */
export const HOMEPAGE_BLOCKS_REVALIDATE_SECONDS = 60;

/** The blocks an admin has switched on, in their chosen order. */
export function visibleBlocks(blocks: readonly HomepageBlock[] | null | undefined): HomepageBlock[] {
  return (blocks ?? [])
    .filter((b) => b && b.visible)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** The pictures a block shows — the new `images` array, or the legacy single
 *  `imageUrl` centred. Blank URLs are dropped. */
export function blockImages(block: HomepageBlock): BlockImage[] {
  if (block.images && block.images.length > 0) return block.images.filter((i) => i && i.url);
  if (block.imageUrl) return [{ url: block.imageUrl, x: 50, y: 50 }];
  return [];
}

/**
 * Reads the hero configuration for a server render.
 *
 * Returns `null` — never throws — when it cannot: the page must still build
 * in CI with placeholder env, and the browser listener fills the gap. Skipped
 * entirely in the native build, whose pages are exported once at build time
 * and would otherwise freeze the hero of that day into the binary.
 */
export async function fetchHomepageBlocks(): Promise<HomepageBlock[] | null> {
  if (IS_NATIVE_BUILD || !hasFirestoreRestConfig()) return null;
  try {
    const doc = await readDocument('settings/homepage_blocks', {
      next: { revalidate: HOMEPAGE_BLOCKS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    const blocks = doc?.blocks;
    if (!Array.isArray(blocks)) return null;
    return visibleBlocks(blocks as HomepageBlock[]);
  } catch (error) {
    console.warn('[homepage-blocks] server read failed; the browser will load the hero', error);
    return null;
  }
}
