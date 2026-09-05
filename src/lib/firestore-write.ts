/**
 * Helpers for building Firestore write payloads.
 *
 * `updateDoc()` and `setDoc()` reject `undefined` outright — the SDK throws
 * *before* any network call, and the message names one offending field while
 * the whole write is lost. In a form that saves every field at once, a single
 * unset optional value therefore takes down the entire save, including the
 * parts the user did fill in.
 *
 * That has bitten this codebase twice in the same shape: a listing created
 * without a price (`price: parseFloat('') || product.price` → `undefined`) and
 * a seller with no saved address (`shippingFromAddressId: undefined`). Both
 * presented as "Save does nothing", and in the second case as "I can't add an
 * image", because images were saved by the same call.
 *
 * Prefer `omitUndefined()` over hand-written delete loops so the next form
 * inherits the fix instead of the bug.
 */

/**
 * Return a shallow copy with every `undefined` value removed.
 *
 * Only the top level, and deliberately: nested `undefined` inside a map or an
 * array is a different failure, and silently rewriting a caller's nested data
 * hides more than it fixes. `null` is left alone — it is a value Firestore
 * stores, and it is how a field is explicitly cleared.
 */
export function omitUndefined<T extends Record<string, any>>(payload: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * Parse a currency/number input, falling back only to a real number.
 *
 * `parseFloat('') || fallback` is the trap this replaces: `NaN` is falsy, so an
 * empty input silently reaches for the fallback — and when the fallback is
 * itself an absent field, the result is `undefined` rather than the "leave it
 * as it was" the code appears to express. Returning `undefined` here is
 * intentional and safe, because `omitUndefined()` then drops the key and the
 * stored value is left untouched.
 */
export function parseNumericInput(input: string, fallback?: number): number | undefined {
  const parsed = parseFloat(input);
  if (Number.isFinite(parsed)) return parsed;
  return Number.isFinite(fallback as number) ? fallback : undefined;
}
