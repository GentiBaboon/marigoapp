import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyIdToken, firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
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

    return NextResponse.json({ ok: true, status: 'processing' });
  } catch (error: any) {
    console.error('[confirm-order] failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Could not confirm the order.' },
      { status: 500 },
    );
  }
}
