import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toNativeHref, NATIVE_ROUTE_PATHS } from '@/lib/platform/routes';

/**
 * These cover the one piece of the native port with no runtime safety net: if a
 * link is translated wrongly the app navigates to a page that does not exist in
 * the bundle, and the shopper gets a blank screen with no error anywhere.
 */
describe('toNativeHref', () => {
  it('moves a product id from the path into the query', () => {
    expect(toNativeHref('/products/abc123')).toBe('/products/view/?id=abc123');
  });

  it('keeps the more specific route from being swallowed by the bare one', () => {
    // `/products/[id]/edit` must not match `/products/[id]` with id='edit'.
    expect(toNativeHref('/products/abc123/edit')).toBe('/products/edit/?id=abc123');
  });

  it('carries every segment of a multi-param route', () => {
    const href = toNativeHref('/products/prod1/offers/offer9');
    expect(href).toContain('/products/offer/?');
    expect(href).toContain('id=prod1');
    expect(href).toContain('offerId=offer9');
  });

  it('uses the real segment name as the query key', () => {
    expect(toNativeHref('/messages/conv42')).toBe('/messages/view/?conversationId=conv42');
    expect(toNativeHref('/profile/orders/ord7')).toBe('/profile/orders/view/?orderId=ord7');
    expect(toNativeHref('/courier/delivery/d1')).toBe('/courier/delivery/view/?deliveryId=d1');
  });

  it('flattens a catch-all into one value', () => {
    expect(toNativeHref('/browse/womenswear/clothing')).toBe(
      '/browse/view/?slug=womenswear%2Fclothing'
    );
  });

  it('preserves an existing query string and hash', () => {
    const href = toNativeHref('/products/abc?variant=2#reviews');
    expect(href).toContain('variant=2');
    expect(href).toContain('id=abc');
    expect(href.endsWith('#reviews')).toBe(true);
  });

  it('decodes an encoded id rather than double-encoding it', () => {
    // The id arrives percent-encoded in the path and must land in the query as
    // a single encoding, or lookups by id miss.
    expect(toNativeHref('/products/a%20b')).toBe('/products/view/?id=a+b');
  });

  it('leaves static in-app routes untouched', () => {
    for (const href of ['/home', '/cart', '/search?q=zara', '/profile/orders', '/sell']) {
      expect(toNativeHref(href)).toBe(href);
    }
  });

  it('never rewrites anything that leaves the app', () => {
    for (const href of [
      'https://stripe.com/checkout',
      '//cdn.example.com/x',
      'mailto:hello@marigoapp.com',
      'tel:+355691234567',
      '#section',
    ]) {
      expect(toNativeHref(href)).toBe(href);
    }
  });

  it('is idempotent — a translated href is not translated again', () => {
    const once = toNativeHref('/products/abc123');
    expect(toNativeHref(once)).toBe(once);
  });

  it('routes every rule at a distinct flat path', () => {
    expect(new Set(NATIVE_ROUTE_PATHS).size).toBe(NATIVE_ROUTE_PATHS.length);
  });

  /**
   * The rule table and the app tree are two halves of one mechanism, and nothing
   * at build time ties them together — a rule pointing at a page that was never
   * created produces a blank screen only on device. This is the check that
   * catches it, so adding a dynamic route without its `/view` sibling fails in
   * CI rather than in review.
   */
  it('has a real exported page behind every rule', () => {
    for (const nativePath of NATIVE_ROUTE_PATHS) {
      const pageFile = path.join(process.cwd(), 'src/app', nativePath, 'page.tsx');
      expect(fs.existsSync(pageFile), `missing native page: src/app${nativePath}/page.tsx`).toBe(
        true
      );
    }
  });
});
