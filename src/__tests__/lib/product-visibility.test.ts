import { describe, it, expect } from 'vitest';
import { isPubliclyViewable, canViewProduct, PUBLIC_PRODUCT_STATUSES } from '@/lib/product-visibility';

describe('isPubliclyViewable', () => {
  it.each(['active', 'reserved', 'sold'])('allows %s', (s) => {
    expect(isPubliclyViewable(s)).toBe(true);
  });

  // The bug: a pending_review listing was served 200 with index,follow.
  it.each(['draft', 'pending_review', 'removed', 'expired'])('hides %s', (s) => {
    expect(isPubliclyViewable(s)).toBe(false);
  });

  it('hides an unknown or missing status rather than defaulting to visible', () => {
    expect(isPubliclyViewable(undefined)).toBe(false);
    expect(isPubliclyViewable(null)).toBe(false);
    expect(isPubliclyViewable('')).toBe(false);
    expect(isPubliclyViewable('something_new')).toBe(false);
  });

  it('exposes exactly three public statuses', () => {
    expect([...PUBLIC_PRODUCT_STATUSES]).toEqual(['active', 'reserved', 'sold']);
  });
});

describe('canViewProduct', () => {
  it('lets anyone see a published listing', () => {
    expect(canViewProduct({ status: 'active', sellerId: 's1' })).toBe(true);
    expect(canViewProduct({ status: 'sold', sellerId: 's1', viewerId: 'other' })).toBe(true);
  });

  it('hides an unpublished listing from the public', () => {
    expect(canViewProduct({ status: 'pending_review', sellerId: 's1' })).toBe(false);
    expect(canViewProduct({ status: 'removed', sellerId: 's1', viewerId: 'other' })).toBe(false);
  });

  // A seller has to be able to open their own draft to work on it.
  it('lets the seller see their own unpublished listing', () => {
    expect(canViewProduct({ status: 'draft', sellerId: 's1', viewerId: 's1' })).toBe(true);
    expect(canViewProduct({ status: 'pending_review', sellerId: 's1', viewerId: 's1' })).toBe(true);
  });

  it('lets an admin through when the caller says so', () => {
    expect(canViewProduct({ status: 'removed', sellerId: 's1', viewerId: 'a1', viewerIsAdmin: true })).toBe(true);
  });

  it('does not treat a signed-out viewer as the seller', () => {
    expect(canViewProduct({ status: 'draft', sellerId: undefined, viewerId: undefined })).toBe(false);
    expect(canViewProduct({ status: 'draft', sellerId: null, viewerId: null })).toBe(false);
  });
});
