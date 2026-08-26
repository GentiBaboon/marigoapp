/**
 * POST /api/presence — one visitor heartbeat.
 * GET  /api/presence — who is on the site right now (admin only).
 *
 * The browser never touches the presence store directly: the Upstash
 * credential stays server-side, and this route is the only writer, so the
 * write path is rate-limited rather than open. See src/lib/presence.ts for why
 * this is not in Firestore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet } from '@/lib/firebase-admin';
import { presenceLimiter, applyRateLimit } from '@/lib/rate-limit';
import { hasPermission } from '@/lib/admin-permissions';
import {
  classifyDevice,
  isPresenceConfigured,
  isValidSessionId,
  normalizePath,
  readLiveSessions,
  recordHeartbeat,
  referrerHost,
  summarizeSessions,
  PRESENCE_HEARTBEAT_MS,
  type PresenceSession,
} from '@/lib/presence';

export const runtime = 'nodejs';
// No `export const dynamic = 'force-dynamic'` here. It is refused outright by
// `output: 'export'` — the Capacitor build — and it bought nothing: both
// handlers read `req.headers` and the POST reads `req.json()`, so Next already
// treats them as dynamic and never statically optimises them. Adding it back
// breaks the iOS and Android builds while changing nothing on the web.

function bearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

export async function POST(req: NextRequest) {
  // Not configured is a no-op, not an error: CI, previews and any deployment
  // without Upstash still render every page, they just have no live view.
  if (!isPresenceConfigured()) {
    return NextResponse.json({ ok: false, configured: false }, { status: 200 });
  }

  const limited = applyRateLimit(req, presenceLimiter);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  // Minted in the browser, so untrusted: pin the shape before it becomes part
  // of a Redis key.
  if (!isValidSessionId(body?.sessionId)) {
    return NextResponse.json({ error: 'Bad session.' }, { status: 400 });
  }

  /**
   * Identity comes from the token, never the body.
   *
   * A body-supplied uid would let anyone populate the operator's live view
   * with whatever names they liked. An invalid or expired token is treated as
   * "anonymous" rather than rejected — a signed-out visitor is exactly who
   * this route exists to count, so there is nothing to fail.
   */
  let uid: string | undefined;
  let name: string | undefined;
  const token = bearer(req);
  if (token) {
    try {
      const claims = await verifyIdToken(token);
      uid = (claims.uid || claims.sub) as string;
      name = ((claims as any).name as string) || ((claims as any).email as string) || undefined;
    } catch {
      uid = undefined;
    }
  }

  const now = Date.now();
  const startedAt = Number(body?.startedAt);
  const session: PresenceSession = {
    sessionId: body.sessionId,
    ...(uid ? { uid, name: name?.slice(0, 80) } : {}),
    path: normalizePath(body?.path),
    device: classifyDevice(req.headers.get('user-agent')),
    referrerHost: referrerHost(body?.referrer),
    // A client-claimed start in the future or the distant past is nonsense;
    // clamp rather than reject, so a skewed clock does not drop the visitor.
    startedAt: Number.isFinite(startedAt) && startedAt > 0 && startedAt <= now ? startedAt : now,
    lastSeenAt: now,
  };

  await recordHeartbeat(session);
  return NextResponse.json({ ok: true, nextBeatMs: PRESENCE_HEARTBEAT_MS });
}

export async function GET(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  let uid: string;
  try {
    const claims = await verifyIdToken(token);
    uid = (claims.uid || claims.sub) as string;
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  /**
   * Role is read from Firestore, not from the token.
   *
   * `useAdminAuth` gates the UI, but a UI gate is not a gate — this endpoint
   * exposes every visitor's location on the site and must check for itself.
   * 404 rather than 403 throughout, matching the masked admin door: there is
   * no reason to confirm this endpoint exists to someone who may not use it.
   */
  const user = await firestoreGet('users', uid, token);
  if (!hasPermission(user?.role as string | undefined, 'analytics.view')) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (!isPresenceConfigured()) {
    return NextResponse.json({ configured: false, summary: null });
  }

  const sessions = await readLiveSessions();
  return NextResponse.json({ configured: true, summary: summarizeSessions(sessions) });
}
