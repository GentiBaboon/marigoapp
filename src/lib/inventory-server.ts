import { firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { orderedQuantity } from '@/lib/stock';

/**
 * @fileOverview Taking stock off a listing, server-side.
 *
 * Shared by the two paths that consume inventory — cash on delivery in
 * `/api/create-order`, and card payments in `/api/confirm-order` once Stripe
 * says the money is actually there. Having one copy is the point: the two had
 * drifted into near-identical blocks, and inventory maths that differs by
 * payment method is inventory maths that will eventually disagree.
 *
 * Reads and writes go through the REST helpers with the caller's own ID token,
 * so Firestore rules still apply exactly as they would in the browser.
 */

export interface StockLine {
  id?: string;
  productId?: string;
  quantity?: unknown;
  selectedSize?: string | null;
  size?: string | null;
}

/**
 * Decrement each line's product, flipping a depleted listing to `reserved`.
 *
 * `reserved` rather than `sold`: the listing stays visible and browsable,
 * marked as taken, instead of vanishing from the catalogue mid-order. It
 * becomes `sold` when the order completes.
 */
export async function decrementStockForItems(items: StockLine[], idToken: string): Promise<void> {
  await Promise.all(
    (items ?? []).map(async (item) => {
      const productId = item.productId || item.id;
      if (!productId) return;

      const p = await firestoreGet('products', productId, idToken);
      if (!p) return;

      // A listing written before `quantity` existed counts as one, matching
      // availableStock() — treating it as zero would strand the back catalogue.
      const currentQty = typeof p.quantity === 'number' ? p.quantity : 1;
      const orderedQty = orderedQuantity(item);
      const remaining = Math.max(0, currentQty - orderedQty);

      const update: Record<string, unknown> = { quantity: remaining };
      if (remaining === 0) update.status = 'reserved';

      // Sized listings: take it off the matching size too, or the size picker
      // keeps offering something that is gone.
      const variants = Array.isArray(p.variants) ? p.variants : null;
      const itemSize = item.selectedSize || item.size;
      if (variants && itemSize) {
        update.variants = variants.map((v: any) =>
          v?.size === itemSize
            ? { ...v, quantity: Math.max(0, (Number(v.quantity) || 0) - orderedQty) }
            : v,
        );
      }

      await firestoreUpdate('products', productId, update, idToken);
    }),
  );
}
