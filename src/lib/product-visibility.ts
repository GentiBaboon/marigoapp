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
