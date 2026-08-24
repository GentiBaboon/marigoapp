/**
 * Email side of an offer event.
 *
 * The offer document itself is written by the client — Firestore rules are the
 * authority on who may create or change one. This route exists only because
 * the SendGrid key cannot be in the browser bundle.
 *
 * Nothing here trusts the request body beyond the two ids: the offer is re-read
 * from Firestore with the *caller's* ID token, so rules apply on this path too
 * (CLAUDE.md §6) and a caller can neither email about an offer they cannot see
 * nor invent the amounts that appear in the message.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { offerLimiter, applyRateLimit } from '@/lib/rate-limit';
import { decodeFirestoreDoc } from '@/lib/firestore-rest';
import { buildProductPath } from '@/lib/product-slug';
import { currentAmount, normalizeStatus } from '@/lib/offers';
import {
  sendOfferReceived,
  sendOfferAccepted,
  sendOfferDeclined,
} from '@/lib/email';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Events worth an email. A withdrawal is not one — the seller loses nothing
 *  by hearing about it in-app, and mailing every retraction trains people to
 *  ignore the channel. */
const EVENTS = ['created', 'accepted', 'declined', 'countered'] as const;
type OfferEvent = (typeof EVENTS)[number];

async function readDoc(path: string, idToken: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null;
  return decodeFirestoreDoc(await res.json());
}

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, offerLimiter);
  if (limited) return limited;

  if (!PROJECT_ID) {
    return NextResponse.json({ ok: false, error: 'firestore not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // The uid lives in `sub`; `uid` is not a claim Firebase actually sets, so
  // reading it returns undefined and 401s every legitimate caller.
  let uid = '';
  try {
    const decoded = await verifyIdToken(idToken);
    uid = decoded.sub || decoded.uid || '';
  } catch {
    uid = '';
  }
  if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { productId, offerId, event } = await req.json().catch(() => ({} as any));
  if (!productId || !offerId || !EVENTS.includes(event)) {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  const [offer, product] = await Promise.all([
    readDoc(`products/${productId}/offers/${offerId}`, idToken),
    readDoc(`products/${productId}`, idToken),
  ]);
  if (!offer || !product) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }

  const buyerId = String(offer.buyerId || '');
  const sellerId = String(product.sellerId || '');
  // Only the two parties can trigger a mail about their own negotiation.
  if (uid !== buyerId && uid !== sellerId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const [buyer, seller] = await Promise.all([
    readDoc(`users/${buyerId}`, idToken),
    readDoc(`users/${sellerId}`, idToken),
  ]);

  const productTitle = String(product.title || 'your item');
  const productPath = buildProductPath({ id: productId, seoSlug: product.seoSlug, title: productTitle } as any);
  const amount = currentAmount({ ...offer, status: normalizeStatus(offer.status as string) });

  let result: { ok: boolean; skipped?: boolean; error?: string } = { ok: false, skipped: true };

  /**
   * Mail the party who did *not* act.
   *
   * A negotiation alternates, so the recipient is never a fixed side: the
   * seller accepting the buyer's offer must reach the buyer, but the buyer
   * accepting the seller's counter must reach the seller. Hardcoding "accepted
   * goes to the buyer" mailed the person who had just clicked the button and
   * left the other side waiting in silence.
   */
  const actedAsSeller = uid === sellerId;
  const recipient = actedAsSeller ? buyer : seller;
  const actorName = (actedAsSeller ? seller : buyer)?.displayName;

  if (!recipient?.email) {
    return NextResponse.json({ ok: false, skipped: true, error: 'no recipient email' });
  }

  switch (event as OfferEvent) {
    // A new offer, or a counter — both are "someone wants to trade at this
    // price", which is exactly what the offer-received template says.
    case 'created':
    case 'countered':
      result = await sendOfferReceived({
        sellerEmail: recipient.email,
        sellerName: recipient.displayName,
        buyerName: actorName,
        productTitle,
        amount,
        offerPath: `${productPath}/offers/${offerId}`,
      });
      break;

    case 'accepted':
      result = await sendOfferAccepted({
        buyerEmail: recipient.email,
        buyerName: recipient.displayName,
        productTitle,
        amount,
        productPath,
      });
      break;

    case 'declined':
      result = await sendOfferDeclined({
        buyerEmail: recipient.email,
        buyerName: recipient.displayName,
        productTitle,
        productPath,
      });
      break;
  }

  return NextResponse.json({ ok: result.ok, skipped: result.skipped ?? false });
}
