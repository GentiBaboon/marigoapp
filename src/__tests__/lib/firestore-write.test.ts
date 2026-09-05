import { describe, it, expect } from 'vitest';
import { omitUndefined, parseNumericInput } from '@/lib/firestore-write';

describe('omitUndefined', () => {
  it('drops undefined but keeps null, 0, empty string and false', () => {
    expect(omitUndefined({ a: undefined, b: null, c: 0, d: '', e: false }))
      .toEqual({ b: null, c: 0, d: '', e: false });
  });

  it('removes the exact key that aborted the listing save', () => {
    // `updateDoc` throws on any undefined and loses the whole payload, so the
    // images beside it were never written either.
    const payload = { images: [{ url: 'x' }], price: undefined, shippingFromAddressId: undefined };
    const out = omitUndefined(payload);
    expect('price' in out).toBe(false);
    expect('shippingFromAddressId' in out).toBe(false);
    expect(out.images).toEqual([{ url: 'x' }]);
  });

  it('does not mutate the input', () => {
    const input = { a: undefined, b: 1 };
    omitUndefined(input);
    expect('a' in input).toBe(true);
  });

  it('leaves nested undefined alone — a different failure, not this one', () => {
    const out = omitUndefined({ nested: { inner: undefined } }) as any;
    expect('inner' in out.nested).toBe(true);
  });
});

describe('parseNumericInput', () => {
  it('parses a normal input', () => {
    expect(parseNumericInput('25', 99)).toBe(25);
    expect(parseNumericInput('0', 99)).toBe(0);
  });

  it('returns undefined for an empty input with no stored fallback', () => {
    // The precise trap: `parseFloat('') || product.price` reached for a
    // fallback that was itself absent, producing undefined and killing
    // the write. Here undefined is intentional — omitUndefined drops it
    // and the stored field is left untouched.
    expect(parseNumericInput('', undefined)).toBeUndefined();
    expect(parseNumericInput('abc', undefined)).toBeUndefined();
  });

  it('falls back to the stored value when the input is empty', () => {
    expect(parseNumericInput('', 47)).toBe(47);
  });

  it('does not treat a valid 0 input as missing', () => {
    // `parseFloat('0') || fallback` would wrongly return the fallback.
    expect(parseNumericInput('0', 47)).toBe(0);
  });
});
