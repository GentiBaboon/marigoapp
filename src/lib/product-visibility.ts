/**
 * Which listing statuses the public may see.
 *
 * `active`, `reserved` and `sold` are all legitimately viewable: a reserved or
 * sold item still deserves a page — people link to them, and a sold listing is
 * evidence the marketplace works. Everything else is a listing that has not
 * been published, or has been withdrawn:
 *
 *   draft           — the seller has not finished it
 *   pending_review  — awaiting moderation, may yet be rejected
 *   removed         — taken down, often for a policy reason
 *   expired         — no longer offered
 *
 * Showing those publicly is a moderation hole rather than a cosmetic one: an
 * item pulled for being counterfeit stayed reachable at its URL, served 200,
 * and carried `robots: index, follow` plus Product JSON-LD — actively inviting
 * Google to index it as purchasable.
 */
import type { ProductStatus } from '@/lib/types';

export const PUBLIC_PRODUCT_STATUSES = ['active', 'reserved', 'sold'] as const;

export function isPubliclyViewable(status: ProductStatus | string | undefined | null): boolean {
  return !!status && (PUBLIC_PRODUCT_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether this viewer may see the listing page at all.
 *
 * The seller keeps access to their own listing whatever its status — they need
 * to see a draft or a pending item to work on it — and so do admins, who
 * moderate from links. Everyone else gets the not-available page.
 */
/**
 * The word a shopper sees on a listing that is public but cannot be bought.
 *
 * `sold` and `reserved` are **not** the same thing and the app used to print
 * "Reserved" for both — on the card's overlay and on the product page's buy
 * button — so a completed order left its listing looking like it was merely
 * being held for someone. Reserved means a cash order is in flight and could
 * still fall through; sold means it is gone. The structured data already drew
 * the distinction (`OutOfStock` for both, but the status is in the document),
 * and only the visible label lagged.
 *
 * `null` for anything a shopper can still buy, so a caller can use it as the
 * whole condition rather than repeating the status list.
 */
export function unavailableLabel(
  status: ProductStatus | string | undefined | null,
): 'Sold' | 'Reserved' | null {
  if (status === 'sold') return 'Sold';
  if (status === 'reserved') return 'Reserved';
  return null;
}

export function canViewProduct(args: {
  status: ProductStatus | string | undefined | null;
  sellerId?: string | null;
  viewerId?: string | null;
  viewerIsAdmin?: boolean;
}): boolean {
  if (isPubliclyViewable(args.status)) return true;
  if (args.viewerIsAdmin) return true;
  return !!args.viewerId && args.viewerId === args.sellerId;
}
