/**
 * POST /api/orders/shipping-origin — change where a seller ships an order
 * from, and re-price the delivery.
 *
 * Authorization: Bearer <Firebase ID token>.
 * Body: `{ orderId, addressId }` — an address from the caller's own book.
 *
 * The seller picks the pickup address on the sale page. Delivery is charged
 * per origin city at the domestic or cross-border rate, so moving the origin
 * can change what the buyer owes: the fee is recomputed here from the
 * server's own copy of every line, never from the request.
 *
 * Three things this deliberately does not do:
 *
 * - **It never takes a city from the body.** The address is read from
 *   `users/{uid}/addresses/{addressId}` with the caller's token, so a seller
 *   can only ship from an address they actually hold, and cannot post
 *   "Tirana" for a parcel leaving Prishtina to dodge the border rate.
 * - **It refuses once the parcel has moved.** After `prepared` the run has
 *   been priced and driven (`canChangeShippingOrigin`).
 * - **It re-prices cash orders only.** A card order is authorised for a
 *   fixed amount; silently changing the total would leave the capture and
 *   the order disagreeing. The origin still moves, the money does not.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { checkAccountStanding } from '@/lib/verified-account';
import { conversationLimiter, applyRateLimit } from '@/lib/rate-limit';
import { canChangeShippingOrigin, recomputeOrderShipping } from '@/lib/order-shipping-origin';
import type { ShippableLine } from '@/lib/shipping';

export const runtime = 'nodejs';

const ID_RE = /^[A-Za-z0-9_-]{1,200}$/;

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, conversationLimiter);
  if (limited) return limited;

  const header = req.headers.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }
  const uid = String(decoded.sub || decoded.uid || '');
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const standing = await checkAccountStanding(decoded, idToken);
  if (!standing.ok) return NextResponse.json(standing.body, { status: standing.status });

  const body = await req.json().catch(() => ({} as any));
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const addressId = typeof body?.addressId === 'string' ? body.addressId : '';
  if (!ID_RE.test(orderId) || !ID_RE.test(addressId)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const order = await firestoreGet('orders', orderId, idToken);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const sellerIds: string[] = Array.isArray(order.sellerIds) ? order.sellerIds.map(String) : [];
    if (!sellerIds.includes(uid)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!canChangeShippingOrigin(order.status)) {
      return NextResponse.json(
        { error: 'This order has already shipped, so the pickup address can no longer change.' },
        { status: 409 },
      );
    }

    // The seller's own address book — the only place an origin may come from.
    const address = await firestoreGet(`users/${uid}/addresses`, addressId, idToken);
    if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    const city = typeof address.city === 'string' ? address.city : null;
    const country = typeof address.country === 'string' ? address.country : null;
    if (!city) {
      return NextResponse.json({ error: 'That address has no city on it.' }, { status: 400 });
    }

    // Every line's origin: the listing's stamp, with any origin a seller has
    // already moved on this order layered over it.
    const stored: Record<string, { city?: string | null; country?: string | null }> =
      (order.shippingOrigins as any) || {};
    const items: Array<Record<string, any>> = Array.isArray(order.items) ? order.items : [];
    const lines: ShippableLine[] = await Promise.all(
      items.map(async (item) => {
        const lineSeller = String(item?.sellerId || '');
        const product = await firestoreGet('products', String(item?.productId || item?.id || ''), idToken).catch(
          () => null,
        );
        const override = stored[lineSeller];
        return {
          sellerId: lineSeller,
          shippingFromCity: override?.city ?? product?.shippingFromCity ?? null,
          shippingFromCountry: override?.country ?? product?.shippingFromCountry ?? null,
        };
      }),
    );

    const settings = await firestoreGet('settings', 'global', idToken).catch(() => null);
    const subtotal =
      typeof order.subtotal === 'number'
        ? order.subtotal
        : items.reduce((sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);
    const isFreeDelivery = Boolean(
      settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0),
    );

    const { shippingFee, total } = recomputeOrderShipping({
      lines,
      overrides: { [uid]: { city, country } },
      destinationCountry: order.shippingAddress?.country ?? null,
      subtotal,
      discount: Number(order.discountAmount) || 0,
      isFreeDelivery,
    });

    const previousTotal = Number(order.totalAmount) || 0;
    // A card order is authorised for a fixed amount; moving the total would
    // leave the capture and the order disagreeing. Cash is collected at the
    // door, so it can follow the real journey.
    const repriced = order.paymentMethod === 'cod';

    // The whole map, merged — `firestoreUpdate` writes each key verbatim, so
    // a dotted `shippingOrigins.<uid>` would create a field with a dot in its
    // name rather than a nested one.
    const update: Record<string, unknown> = {
      shippingOrigins: {
        ...stored,
        [uid]: { city, country, addressId, updatedAt: new Date().toISOString() },
      },
    };
    if (repriced) {
      update.shippingFee = shippingFee;
      update.totalAmount = total;
    }
    await firestoreUpdate('orders', orderId, update, idToken);

    return NextResponse.json({
      ok: true,
      city,
      country,
      repriced,
      shippingFee: repriced ? shippingFee : Number(order.shippingFee) || 0,
      total: repriced ? total : previousTotal,
      previousTotal,
      totalChanged: repriced && Math.abs(total - previousTotal) > 0.005,
    });
  } catch (err: any) {
    console.error('[orders/shipping-origin] failed:', err?.message ?? err);
    return NextResponse.json({ error: 'Could not update the pickup address.' }, { status: 500 });
  }
}
