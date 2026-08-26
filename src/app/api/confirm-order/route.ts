import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyIdToken, firestoreGet, firestoreUpdate, firestoreCreate, firestoreQuery } from '@/lib/firebase-admin';
import { sendOrderConfirmation, sendSellerOrderNotification, sendAdminNewOrder } from '@/lib/email';
import { decrementStockForItems } from '@/lib/inventory-server';
import { paymentIntentLimiter, applyRateLimit } from '@/lib/rate-limit';

/**
 * @fileOverview Take the stock, once the money is actually held.
 *
 * `/api/create-payment-intent` used to reserve inventory before the card was
 * confirmed, which stranded listings on every abandoned checkout. The
 * reservation moved here, behind proof of payment.
 *
 * Two things this must not do:
 *
 * - **Trust the client.** The browser saying "it worked" is not evidence, so
 *   the intent is re-read from Stripe and its status checked server-side. A
 *   forged call gets nothing.
 * - **Take the stock twice.** The order's own status is the guard: inventory
 *   moves only on the `pending_payment` → `processing` transition, so a retry,
 *   a double-click or a replayed request is a no-op.
 */

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) throw new Error('Stripe secret key not configured.');
  return new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
}

/** Manual capture means a paid order sits at `requires_capture`, not `succeeded`. */
const PAID_STATUSES = ['requires_capture', 'succeeded'];

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, paymentIntentLimiter);
  if (limited) return limited;

  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await verifyIdToken(idToken);
    const buyerId = decoded?.uid;
    if (!buyerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const order = await firestoreGet('orders', orderId, idToken);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    // The order is the caller's, or this is someone poking at an id.
    if (order.buyerId !== buyerId) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Already confirmed — say so without touching inventory again.
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ ok: true, status: order.status, alreadyConfirmed: true });
    }

    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Order has no payment intent.' }, { status: 400 });
    }

    // The only evidence that counts: Stripe's own view of the intent.
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!PAID_STATUSES.includes(pi.status)) {
      return NextResponse.json(
        { error: `Payment is not complete (${pi.status}).`, status: pi.status },
        { status: 409 },
      );
    }

    // Move the order first. It is the idempotency guard, so it has to be the
    // thing that flips — a crash after this point leaves stock untaken, which
    // an admin can see and correct, rather than stock taken twice, which
    // nobody can detect.
    const now = new Date().toISOString();
    await firestoreUpdate(
      'orders',
      orderId,
      {
        status: 'processing',
        paidAt: now,
        statusHistory: [
          ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
          { status: 'processing', at: now, by: buyerId },
        ],
      },
      idToken,
    );

    await decrementStockForItems(order.items || [], idToken);

    // Everything below is the announcement that a sale happened, so it belongs
    // here rather than at intent creation: none of it is true until the money
    // is held. All of it is best-effort — the payment is captured and the
    // order is moved, so a failed email must not fail the request.
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const sellerIds: string[] = Array.isArray(order.sellerIds) ? order.sellerIds : [];
    const orderNumber = order.orderNumber || orderId;
    const firstItem: any = items[0] || {};
    const productTitle: string = firstItem.title || `#${orderNumber}`;

    // The coupon's use is spent now, not when the intent was created — an
    // abandoned checkout used to burn a single-use code for an order that
    // never happened.
    if (order.couponCode) {
      try {
        const coupons = await firestoreQuery('coupons', 'code', String(order.couponCode).toUpperCase(), idToken);
        if (coupons.length > 0) {
          const { id: couponDocId, data: coupon } = coupons[0];
          await firestoreUpdate(
            'coupons',
            couponDocId,
            { usedCount: (coupon.usedCount || 0) + 1 },
            idToken,
          );
        }
      } catch (e) {
        console.warn('[confirm-order] coupon usage not recorded', e);
      }
    }

    const buyerData = await firestoreGet('users', buyerId, idToken).catch(() => null);
    if (buyerData?.email) {
      sendOrderConfirmation({
        buyerEmail: buyerData.email,
        buyerName: buyerData.name || 'Customer',
        orderNumber,
        orderId,
        items,
        totalAmount: order.totalAmount,
        paymentMethod: 'card',
        shippingAddress: order.shippingAddress,
      }).catch(console.error);
    }

    for (const sellerId of sellerIds) {
      const sellerData = await firestoreGet('users', sellerId, idToken).catch(() => null);
      if (sellerData?.email) {
        sendSellerOrderNotification({
          sellerEmail: sellerData.email,
          sellerName: sellerData.name || 'Seller',
          orderNumber,
          orderId,
          items: items.filter((i: any) => i.sellerId === sellerId),
          totalAmount: order.totalAmount,
        }).catch(console.error);
      }
      firestoreCreate(
        'notifications',
        {
          userId: sellerId,
          title: `New sale — ${productTitle}`,
          message: 'You have a new order to prepare.',
          type: 'order_update',
          read: false,
          createdAt: now,
          data: firstItem.image
            ? { link: `/profile/listings/sales/${orderId}`, imageUrl: firstItem.image }
            : { link: `/profile/listings/sales/${orderId}` },
        },
        idToken,
      ).catch((e) => console.warn('seller notification failed', e));
    }

    firestoreCreate(
      'notifications',
      {
        userId: buyerId,
        title: `${productTitle} — Order placed`,
        message: 'Your order has been received.',
        type: 'order_update',
        read: false,
        createdAt: now,
        data: firstItem.image
          ? { link: `/profile/orders/${orderId}`, imageUrl: firstItem.image }
          : { link: `/profile/orders/${orderId}` },
      },
      idToken,
    ).catch((e) => console.warn('buyer notification failed', e));

    // Operational alert. The card is authorised, not captured, at this point —
    // the template says so, because an admin reading it must not assume the
    // money has moved.
    sendAdminNewOrder({
      orderNumber,
      orderId,
      buyerName: buyerData?.displayName || buyerData?.name,
      buyerEmail: buyerData?.email,
      items,
      totalAmount: order.totalAmount,
      paymentMethod: 'card',
      sellerCount: sellerIds.length,
      shippingAddress: order.shippingAddress,
    }).catch(console.error);

    return NextResponse.json({ ok: true, status: 'processing' });
  } catch (error: any) {
    console.error('[confirm-order] failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Could not confirm the order.' },
      { status: 500 },
    );
  }
}
