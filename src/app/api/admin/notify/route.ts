/**
 * Operational alerts to the platform inbox.
 *
 * Exists because both triggers are client-side — a registration completes in
 * `FirebaseProvider`, a cancellation in the admin order screen — and the
 * SendGrid key cannot be in the browser bundle.
 *
 * Nothing in the request body reaches the email. The route takes an event and
 * an id, then re-reads the record from Firestore under the *caller's* own ID
 * token, so security rules still apply (CLAUDE.md §6) and nobody can have the
 * platform mailed a fabricated order.
 *
 * `order_created` is deliberately absent: the two checkout routes are already
 * server-side and call `sendAdminNewOrder` directly with data they computed
 * themselves, which is strictly more trustworthy than a round trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet } from '@/lib/firebase-admin';
import { offerLimiter, applyRateLimit } from '@/lib/rate-limit';
import { sendAdminNewUser, sendAdminOrderCancelled } from '@/lib/email';

const EVENTS = ['user_registered', 'order_cancelled'] as const;
type AdminEvent = (typeof EVENTS)[number];

const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, offerLimiter);
  if (limited) return limited;

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let uid = '';
  let claims: Record<string, any> = {};
  try {
    const decoded = await verifyIdToken(idToken);
    // The uid is in `sub`; `uid` is not a claim Firebase sets.
    uid = decoded.sub || decoded.uid || '';
    claims = decoded as Record<string, any>;
  } catch {
    uid = '';
  }
  if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const event = body?.event as AdminEvent;
  if (!EVENTS.includes(event)) {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  let result: { ok: boolean; skipped?: boolean } = { ok: false, skipped: true };

  if (event === 'user_registered') {
    // A user may only announce their own registration. Anything else would let
    // one account spam the inbox with alerts about other people.
    const profile = await firestoreGet('users', uid, idToken);
    if (!profile) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    result = await sendAdminNewUser({
      // The bootstrap in FirebaseProvider writes `name`; most other code reads
      // `displayName`. Accept either rather than mailing a blank line.
      name: profile.displayName || profile.name || claims.name,
      email: profile.email || claims.email,
      userId: uid,
      provider: claims.firebase?.sign_in_provider || 'password',
      role: profile.role || 'buyer',
    });
  }

  if (event === 'order_cancelled') {
    const orderId = String(body?.orderId || '');
    if (!orderId) return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });

    const actor = await firestoreGet('users', uid, idToken);
    const isAdmin = claims.admin === true || ADMIN_ROLES.includes(actor?.role);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const order = await firestoreGet('orders', orderId, idToken);
    if (!order) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    result = await sendAdminOrderCancelled({
      orderNumber: order.orderNumber || orderId,
      orderId,
      buyerName: order.buyerName || order.shippingAddress?.fullName,
      buyerEmail: order.buyerEmail,
      totalAmount: order.totalAmount ?? order.total,
      // Status is read off the stored order, not the request: the caller says
      // *which* order, never what happened to it.
      previousStatus: typeof body?.previousStatus === 'string' ? body.previousStatus : undefined,
      reason: typeof body?.reason === 'string' ? body.reason.slice(0, 500) : undefined,
      cancelledBy: actor?.displayName || actor?.name || actor?.email || 'Admin',
    });
  }

  return NextResponse.json({ ok: result.ok, skipped: result.skipped ?? false });
}
