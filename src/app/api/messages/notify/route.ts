/**
 * POST /api/messages/notify — email the other party about a new message.
 *
 * Authorization: Bearer <Firebase ID token>.  Body: `{ conversationId }`.
 *
 * Called fire-and-forget by `ChatInput` after the message and the unread
 * bump are written under Firestore rules. The route never trusts the body
 * for anything but the id: it re-reads the conversation with the **caller's
 * own token**, so a non-participant gets a 404 from the rules rather than a
 * way to make Marigo mail strangers, and it takes the recipient, the sender's
 * name and the preview from that document.
 *
 * **One email per unread stretch.** The seller is mailed only when this
 * message is the *first* they have not read — `unreadCount[recipient] == 1`
 * after the client's increment. A twenty-message conversation produces one
 * email, and the next comes only after they have opened the thread (which
 * resets the counter to 0). A recipient who is reading live never gets one.
 * No extra write, no extra field: the counter the header badge already
 * keeps is the ledger.
 *
 * Until 2026-09-11 nothing sent this mail at all: the template existed and
 * had no caller, so a seller who was not on the site learned of a message
 * only from the badge on their next visit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet } from '@/lib/firebase-admin';
import { checkAccountStanding } from '@/lib/verified-account';
import { messageMailLimiter, applyRateLimit } from '@/lib/rate-limit';
import { sendMessageNotification } from '@/lib/email';

export const runtime = 'nodejs';

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const PREVIEW_CHARS = 160;

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, messageMailLimiter);
  if (limited) return limited;

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const uid = String(decoded.sub || decoded.uid || '');
  if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // A banned member's message never reaches the recipient's inbox, whatever
  // the rules let them write — see checkAccountStanding.
  const standing = await checkAccountStanding(decoded, idToken);
  if (!standing.ok) return NextResponse.json(standing.body, { status: standing.status });

  const body = await req.json().catch(() => ({} as any));
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
  if (!ID_RE.test(conversationId)) {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  try {
    const conv = await firestoreGet('conversations', conversationId, idToken);
    if (!conv) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    const participants: string[] = Array.isArray(conv.participants) ? conv.participants.map(String) : [];
    if (!participants.includes(uid)) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }
    if (conv.caseClosed) return NextResponse.json({ ok: true, mailed: false, reason: 'closed' });

    const recipientId = participants.find((p) => p !== uid);
    if (!recipientId) return NextResponse.json({ ok: true, mailed: false, reason: 'no_recipient' });

    const unread = Number(conv.unreadCount?.[recipientId] ?? 0);
    if (unread !== 1) {
      return NextResponse.json({ ok: true, mailed: false, reason: unread === 0 ? 'read' : 'already_unread' });
    }

    const recipient = await firestoreGet('users', recipientId, idToken);
    const recipientEmail = typeof recipient?.email === 'string' ? recipient.email.trim() : '';
    if (!recipientEmail) return NextResponse.json({ ok: true, mailed: false, reason: 'no_email' });

    const details: Array<{ userId?: string; name?: string }> = Array.isArray(conv.participantDetails)
      ? conv.participantDetails
      : [];
    const senderName =
      details.find((d) => d?.userId === uid)?.name ||
      (typeof (decoded as any).name === 'string' && (decoded as any).name) ||
      'A Marigo member';
    const recipientName =
      details.find((d) => d?.userId === recipientId)?.name ||
      (typeof recipient?.displayName === 'string' && recipient.displayName) ||
      (typeof recipient?.name === 'string' && recipient.name) ||
      undefined;
    const preview = typeof conv.lastMessage === 'string' ? conv.lastMessage.slice(0, PREVIEW_CHARS) : undefined;

    const result = await sendMessageNotification({
      recipientEmail,
      recipientName: recipientName || undefined,
      senderName,
      productTitle: typeof conv.productTitle === 'string' ? conv.productTitle : undefined,
      preview,
      conversationId,
    });

    if (!result.ok && !result.skipped) {
      console.error('[messages/notify] send failed:', result.error);
      return NextResponse.json({ ok: false, mailed: false, error: 'send failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, mailed: !result.skipped });
  } catch (err: any) {
    console.error('[messages/notify] error:', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
