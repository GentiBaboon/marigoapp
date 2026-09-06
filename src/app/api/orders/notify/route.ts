/**
 * Email side of an order status change.
 *
 * The status itself is written in the browser — by the seller advancing to
 * "shipped", or an admin completing or cancelling — under Firestore rules.
 * This route only sends the buyer the matching email, because the SendGrid
 * key cannot be in the bundle.
 *
 * Nothing in the body is trusted beyond the order id and the status name:
 *  - the order is re-read with the *caller's* token, so rules decide who can
 *    even see it (buyer, its sellers, admins);
 *  - the mail is refused unless the order is **actually in** that status, so
 *    no caller can have a buyer told their parcel shipped when it did not;
 *  - `mailedStatuses` on the order makes it one mail per status, whichever
 *    surface fires first — an admin re-saving "completed" mails nobody twice.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { orderMailLimiter, applyRateLimit } from '@/lib/rate-limit';
import { sendOrderShipped, sendOrderDelivered, sendOrderCancelled } from '@/lib/email';
import { alreadyMailed, isOrderMailStatus, withMailed } from '@/lib/order-mail';
import { DEFAULT_REFUND_WINDOW_DAYS } from '@/lib/types';

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, orderMailLimiter);
  if (limited) return limited;

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    // The uid lives in `sub`; only the token's validity matters here — the
    // order read below is what decides whether this caller may see it.
    await verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const status = body?.status;
  if (!orderId) return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  // Intermediate steps are in-app only; answer quietly so call sites can
  // pass every transition without branching.
  if (!isOrderMailStatus(status)) return NextResponse.json({ ok: true, skipped: true, reason: 'no email for status' });

  const order = await firestoreGet('orders', orderId, idToken).catch(() => null);
  if (!order) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

  if (order.status !== status) {
    return NextResponse.json({ ok: false, error: 'order is not in that status' }, { status: 409 });
  }
  if (alreadyMailed(order, status)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already sent' });
  }

  const buyer = order.buyerId ? await firestoreGet('users', String(order.buyerId), idToken).catch(() => null) : null;
  if (!buyer?.email) return NextResponse.json({ ok: false, skipped: true, error: 'no recipient email' });

  const common = {
    buyerEmail: String(buyer.email),
    buyerName: (buyer.name || buyer.displayName || undefined) as string | undefined,
    orderNumber: String(order.orderNumber || orderId),
    orderId,
  };

  let result: { ok: boolean; skipped?: boolean; error?: string };
  switch (status) {
    case 'shipped':
      result = await sendOrderShipped(common);
      break;
    case 'completed': {
      // "Completed" is the delivered-and-closed state; the return window in
      // the mail is the live setting, not a number typed into the template.
      const settings = await firestoreGet('settings', 'global', idToken).catch(() => null);
      const days = typeof settings?.refundWindowDays === 'number' ? settings.refundWindowDays : DEFAULT_REFUND_WINDOW_DAYS;
      result = await sendOrderDelivered({ ...common, inspectionDays: days });
      break;
    }
    case 'cancelled':
      result = await sendOrderCancelled({
        ...common,
        reason: typeof order.cancellationReason === 'string' ? order.cancellationReason : undefined,
        paymentMethod: order.paymentMethod === 'cod' ? 'cod' : 'card',
      });
      break;
  }

  if (result.ok) {
    // Best effort: a failure to record the send must not fail the send.
    await firestoreUpdate('orders', orderId, { mailedStatuses: withMailed(order, status) }, idToken).catch((err) =>
      console.warn('[orders/notify] could not record mailed status', err),
    );
  }

  return NextResponse.json({ ok: result.ok, skipped: result.skipped ?? false });
}
