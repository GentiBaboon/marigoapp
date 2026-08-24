/**
 * Server-side resolution of an agreed offer price.
 *
 * Checkout deliberately re-reads every price from Firestore and ignores what
 * the client sent (`calculateOrderTotal`), which is correct — but it also meant
 * an accepted offer was unbuyable at the agreed figure: the buyer clicked
 * "Buy now at €70" and was charged the €100 list price.
 *
 * The fix is *not* to trust the cart. It is to look the negotiation up here,
 * on the server, under the buyer's own token, and let the accepted offer
 * override the listing price. A buyer with no accepted offer is unaffected.
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function decode(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  return null;
}

/**
 * The price `buyerId` has agreed for `productId`, or null.
 *
 * Returns the lowest accepted offer if somehow more than one exists — the
 * buyer was told a number, and charging them more than the smallest one they
 * were shown is the failure mode that matters.
 */
export async function acceptedOfferPrice(
  productId: string,
  buyerId: string,
  idToken: string,
): Promise<number | null> {
  if (!PROJECT_ID || !productId || !buyerId) return null;

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'offers' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'buyerId' }, op: 'EQUAL', value: { stringValue: buyerId } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'accepted' } } },
          ],
        },
      },
      limit: { value: 5 },
    },
  };

  try {
    const res = await fetch(`${BASE}/products/${productId}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;

    const rows = await res.json();
    const prices: number[] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const f = row?.document?.fields;
      if (!f) continue;
      // `agreedPrice` is stamped at acceptance. The counter and the original
      // offer are the fallbacks for an offer accepted before that field
      // existed — in that order, since a counter supersedes the opening bid.
      const price =
        decode(f.agreedPrice) ?? decode(f.counterOfferAmount) ?? decode(f.offerAmount) ?? decode(f.amount);
      if (typeof price === 'number' && price > 0) prices.push(price);
    }
    return prices.length ? Math.min(...prices) : null;
  } catch (err) {
    // Never block a checkout over this. Falling back to the list price is the
    // safe direction: the buyer is charged what the listing says.
    console.error('[offer-pricing] lookup failed:', err);
    return null;
  }
}
