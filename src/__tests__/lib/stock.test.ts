import { describe, it, expect } from 'vitest';
import {
  availableStock,
  orderedQuantity,
  canFulfil,
  stockRestoreForStatusChange,
} from '@/lib/stock';

describe('availableStock', () => {
  it('reads the top-level quantity on a plain listing', () => {
    expect(availableStock({ quantity: 3 })).toBe(3);
    expect(availableStock({ quantity: 0 })).toBe(0);
  });

  it('counts a listing with no quantity field as one, not sold out', () => {
    // The field was added after the earliest listings were written; treating
    // those as zero would empty the back catalogue.
    expect(availableStock({})).toBe(1);
  });

  it('never returns a negative', () => {
    expect(availableStock({ quantity: -4 })).toBe(0);
  });

  it('uses the per-size figure on a sized listing, not the mirror', () => {
    const p = { quantity: 5, variants: [{ size: 'S', quantity: 0 }, { size: 'M', quantity: 2 }] };
    expect(availableStock(p, 'S')).toBe(0);
    expect(availableStock(p, 'M')).toBe(2);
    expect(availableStock(p, 'XL')).toBe(0); // size not carried at all
    expect(availableStock(p)).toBe(2);       // whole listing = sum of sizes
  });
});

describe('orderedQuantity', () => {
  it('defaults anything unusable to one', () => {
    expect(orderedQuantity({ quantity: 2 })).toBe(2);
    expect(orderedQuantity({})).toBe(1);
    expect(orderedQuantity({ quantity: 0 })).toBe(1);
    expect(orderedQuantity(null)).toBe(1);
  });
});

describe('canFulfil — the bug this exists for', () => {
  it('refuses a listing that is active but has no stock', () => {
    // Exactly the state a manual reserved -> active flip used to leave behind.
    expect(canFulfil({ status: 'active', quantity: 0 }, { quantity: 1 })).toBe(false);
  });

  it('allows a normal in-stock listing', () => {
    expect(canFulfil({ status: 'active', quantity: 1 }, { quantity: 1 })).toBe(true);
  });

  it('refuses more units than are left', () => {
    expect(canFulfil({ status: 'active', quantity: 1 }, { quantity: 2 })).toBe(false);
  });

  it('checks the selected size, not the listing total', () => {
    const p = { status: 'active', variants: [{ size: 'S', quantity: 0 }, { size: 'M', quantity: 1 }] };
    expect(canFulfil(p, { selectedSize: 'S', quantity: 1 })).toBe(false);
    expect(canFulfil(p, { selectedSize: 'M', quantity: 1 })).toBe(true);
  });

  it('still allows a legacy listing with no quantity field', () => {
    expect(canFulfil({ status: 'active' }, { quantity: 1 })).toBe(true);
  });
});

describe('stockRestoreForStatusChange', () => {
  it('gives the unit back when an admin un-reserves a listing', () => {
    expect(stockRestoreForStatusChange({ quantity: 0 }, 'reserved', 'active')).toEqual({ quantity: 1 });
  });

  it('leaves a listing that still has stock alone', () => {
    expect(stockRestoreForStatusChange({ quantity: 2 }, 'reserved', 'active')).toBeNull();
  });

  it('only fires on reserved -> active', () => {
    expect(stockRestoreForStatusChange({ quantity: 0 }, 'active', 'removed')).toBeNull();
    expect(stockRestoreForStatusChange({ quantity: 0 }, 'pending_review', 'active')).toBeNull();
    expect(stockRestoreForStatusChange({ quantity: 0 }, 'reserved', 'sold')).toBeNull();
  });

  it('does not invent stock for a sized listing', () => {
    // Nothing here can know which size was taken, and faking a unit would put
    // the top-level mirror out of step with the variants.
    const p = { quantity: 0, variants: [{ size: 'S', quantity: 0 }] };
    expect(stockRestoreForStatusChange(p, 'reserved', 'active')).toBeNull();
  });
});
