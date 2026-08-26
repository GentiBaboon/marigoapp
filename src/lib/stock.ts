/**
 * @fileOverview How much of a listing is actually left.
 *
 * Deliberately pure and dependency-free: the checkout routes reach Firestore
 * over REST and the admin screens use the client SDK, so the one thing they
 * can share is the rule itself. `order-inventory.ts` is `'use client'` and
 * cannot be imported into an API route.
 *
 * Stock lives in two shapes. A plain listing carries a top-level `quantity`.
 * A listing with sizes carries `variants[]`, and its top-level `quantity`
 * merely mirrors their total — so for those the per-size figure is the real
 * one and the mirror must never be trusted on its own.
 */

export interface StockVariant {
  size?: string;
  quantity?: unknown;
}

export interface StockProduct {
  status?: string;
  quantity?: unknown;
  variants?: unknown;
}

const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;

function variantsOf(product: StockProduct): StockVariant[] | null {
  const v = product?.variants;
  return Array.isArray(v) && v.length > 0 ? (v as StockVariant[]) : null;
}

/**
 * Units of `size` still sellable. Omit `size` for the whole listing.
 *
 * A listing with no `quantity` field at all counts as 1, not 0 — the field was
 * added after the first listings were written, and treating those as sold out
 * would empty the back catalogue. This mirrors the `?? 1` fallback the
 * checkout decrement has always used.
 */
export function availableStock(product: StockProduct | null | undefined, size?: string | null): number {
  if (!product) return 0;

  const variants = variantsOf(product);
  if (variants) {
    if (size) {
      const match = variants.find(v => v?.size === size);
      return Math.max(0, asCount(match?.quantity) ?? 0);
    }
    return variants.reduce((sum, v) => sum + Math.max(0, asCount(v?.quantity) ?? 0), 0);
  }

  const qty = asCount(product.quantity);
  return Math.max(0, qty === null ? 1 : qty);
}

/** Units an order line asks for. Anything unusable counts as one. */
export function orderedQuantity(line: { quantity?: unknown } | null | undefined): number {
  const q = asCount(line?.quantity);
  return q !== null && q > 0 ? q : 1;
}

/**
 * Can this line be fulfilled right now?
 *
 * Status alone was the old test, and it let a listing that was `active` with
 * `quantity: 0` sell — then the decrement recomputed `remaining` as 0 and
 * flipped it straight back to `reserved`, so the same unit could be sold
 * repeatedly.
 */
export function canFulfil(
  product: StockProduct | null | undefined,
  line: { quantity?: unknown; selectedSize?: string | null; size?: string | null } | null | undefined,
): boolean {
  if (!product) return false;
  const size = line?.selectedSize || line?.size || null;
  return availableStock(product, size) >= orderedQuantity(line);
}

/**
 * The stock fields to write alongside a manual status change.
 *
 * Moving a listing out of `reserved` by hand is only half an undo: checkout
 * reserved it by writing *two* fields (`quantity: 0` and `status: 'reserved'`)
 * and the status control writes one. That left listings `active` with no
 * stock, which sold and then immediately re-reserved themselves.
 *
 * The proper inverse is `releaseOrderItems`, but it restores an order's line
 * quantities and an abandoned checkout leaves no order — so there is nothing
 * to restore *from*. One unit is the honest floor: every listing in the
 * catalogue is a single item, and a listing that is live has at least one.
 *
 * Sized listings are left alone deliberately. Their stock is per size and
 * nothing here can know which size was taken, so inventing a unit would put
 * the mirror and the variants out of step. Those are restocked in the edit
 * form, where the admin picks the size.
 */
export function stockRestoreForStatusChange(
  product: StockProduct | null | undefined,
  previousStatus: string | undefined,
  newStatus: string,
): { quantity: number } | null {
  if (!product) return null;
  if (previousStatus !== 'reserved' || newStatus !== 'active') return null;
  if (variantsOf(product)) return null;
  return availableStock(product) > 0 ? null : { quantity: 1 };
}
