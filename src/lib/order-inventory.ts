'use client';

import { doc, getDoc, updateDoc, increment, type Firestore } from 'firebase/firestore';

type OrderLine = { id: string; quantity?: number };

/**
 * Quantity-aware inventory helpers used by every order-status surface
 * (admin detail, admin orders list, refunds, returns, dispute resolution).
 *
 * Marketplace rules:
 * - At checkout: product.quantity is decremented by the ordered amount.
 *   If remaining stock hits 0 the listing flips from `active` → `reserved`
 *   so it stays visible but blocks new orders. Listings with stock left
 *   stay `active`.
 * - On order completion: depleted listings flip `reserved` → `sold`.
 *   Listings still in stock remain untouched (`active`).
 * - On cancel / refund / dispute resolution: the ordered quantity is added
 *   back, and the listing returns to `active` so other buyers can purchase
 *   any remaining units.
 *
 * All writes are best-effort — a single failure doesn't abort the rest,
 * since the caller has already updated the order doc.
 */

const fallbackOrdered = (qty: unknown) =>
  typeof qty === 'number' && qty > 0 ? qty : 1;

/**
 * Restore order-line quantities back to the product and flip status to
 * `active`. Used when an order is cancelled/refunded.
 */
export async function releaseOrderItems(
  firestore: Firestore,
  items: OrderLine[] | undefined,
) {
  if (!items?.length) return;
  await Promise.all(
    items.map(async (it) => {
      if (!it?.id) return;
      const qty = fallbackOrdered(it.quantity);
      try {
        await updateDoc(doc(firestore, 'products', it.id), {
          quantity: increment(qty),
          status: 'active',
        });
      } catch {
        /* swallow — best effort */
      }
    }),
  );
}

/**
 * Finalize an order — flip any items that are out of stock from `reserved`
 * to `sold`. Items with remaining stock stay untouched (still `active`).
 */
export async function markOrderItemsSoldIfDepleted(
  firestore: Firestore,
  items: OrderLine[] | undefined,
) {
  if (!items?.length) return;
  await Promise.all(
    items.map(async (it) => {
      if (!it?.id) return;
      try {
        const ref = doc(firestore, 'products', it.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as { quantity?: number; status?: string };
        const qty = typeof data.quantity === 'number' ? data.quantity : 0;
        if (qty <= 0 && data.status !== 'sold') {
          await updateDoc(ref, { status: 'sold' });
        }
      } catch {
        /* swallow */
      }
    }),
  );
}
