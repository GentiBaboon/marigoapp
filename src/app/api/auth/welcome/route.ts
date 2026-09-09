/**
 * POST /api/auth/welcome — send the welcome email to a provider-verified
 * account (Google today; Apple if it returns).
 *
 * Authorization: Bearer <Firebase ID token>. No body. Called once by the
 * first-login bootstrap in `src/firebase/provider.tsx` after it creates the
 * `users/{uid}` document for a new account whose provider vouched for the
 * address. Password accounts do not come here: `/api/auth/verify-otp`
 * welcomes them itself when their code is accepted.
 *
 * The address comes from the token, never the body, and `checkAccountAccess`
 * refuses an unconfirmed password account (403 `email_unverified`) — so a
 * welcome cannot be aimed at a stranger, and cannot reach an inbox that has
 * not been shown to exist. `sendWelcomeOnce` makes a repeat call a no-op.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { checkAccountAccess } from '@/lib/verified-account';
import { welcomeLimiter, applyRateLimit } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/otp';
import { sendWelcomeOnce } from '@/lib/welcome-mail';

export const runtime = 'nodejs';

function bearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, welcomeLimiter);
  if (limited) return limited;

  const idToken = bearer(req);
  if (!idToken) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  let name: string | undefined;
  try {
    const token = await verifyIdToken(idToken);
    uid = (token.uid || token.sub) as string;
    email = normalizeEmail(String((token as any).email ?? ''));
    name = ((token as any).name as string) || undefined;
    const access = await checkAccountAccess(token, idToken);
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  if (!uid || !email) {
    return NextResponse.json({ error: 'This account has no email address.' }, { status: 400 });
  }

  const outcome = await sendWelcomeOnce({ uid, email, idToken, tokenName: name });
  return NextResponse.json({ success: true, ...outcome });
}
