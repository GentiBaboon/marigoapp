/**
 * POST /api/auth/verify-otp — check a submitted code and activate the account.
 *
 * Authorization: Bearer <Firebase ID token>.  Body: `{ code: "123456" }`.
 *
 * Success writes three things to `users/{uid}`: `emailVerified`,
 * `emailVerifiedAt`, and `emailVerificationProof` — the last being the only
 * one server code should trust. See the header of `src/lib/otp.ts` for why the
 * boolean alone is not evidence in an architecture with no service-account key.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { otpVerifyLimiter, applyRateLimit } from '@/lib/rate-limit';
import {
  checkOtp,
  getOtpSecret,
  hasVerifiedEmail,
  normalizeEmail,
  normalizeOtp,
  verificationProof,
  type OtpChallenge,
  type OtpFailure,
} from '@/lib/otp';

export const runtime = 'nodejs';

/** What the user is told, per failure. Deliberately specific: "expired" sends
 *  them to Resend, "incorrect" sends them back to the keypad, and confusing
 *  the two is the fastest way to make a working flow feel broken. Nothing here
 *  reveals whether a challenge exists for some *other* account, because the
 *  route only ever looks at the caller's own. */
const MESSAGES: Record<OtpFailure, string> = {
  no_challenge: 'No active code. Request a new one.',
  expired: 'That code has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  email_changed: 'Your email address changed. Request a new code.',
  incorrect: 'That code is not correct.',
};

function bearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, otpVerifyLimiter);
  if (limited) return limited;

  const idToken = bearer(req);
  if (!idToken) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  let tokenName: string | undefined;
  try {
    const token = await verifyIdToken(idToken);
    uid = (token.uid || token.sub) as string;
    email = normalizeEmail(String((token as any).email ?? ''));
    tokenName = ((token as any).name as string) || undefined;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  if (!uid || !email) {
    return NextResponse.json({ error: 'This account has no email address.' }, { status: 400 });
  }

  let submitted: string;
  try {
    const body = await req.json();
    submitted = normalizeOtp(String(body?.code ?? ''));
  } catch {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  let secret: string;
  try {
    secret = getOtpSecret();
  } catch (err: any) {
    console.error('[otp] not configured:', err?.message ?? err);
    return NextResponse.json({ error: 'Verification is not configured.' }, { status: 500 });
  }

  try {
    const user = await firestoreGet('users', uid, idToken);

    // Idempotent: a double-submitted form, or a retry after a dropped
    // response, should land on "you're in" rather than "no active code".
    if (hasVerifiedEmail(secret, uid, email, user)) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const challenge = (await firestoreGet('email_verifications', uid, idToken)) as OtpChallenge | null;
    const result = checkOtp(secret, uid, email, submitted, challenge);

    if (!result.ok) {
      // Only a wrong guess costs an attempt. Charging for an expired or
      // already-burned challenge would let a stale tab lock a user out of a
      // code they have not even received yet.
      if (result.reason === 'incorrect') {
        await firestoreUpdate(
          'email_verifications',
          uid,
          { attempts: Number(challenge?.attempts ?? 0) + 1 },
          idToken,
        ).catch((err) => console.error('[otp] attempt counter write failed:', err?.message ?? err));
      }
      return NextResponse.json(
        {
          error: MESSAGES[result.reason],
          reason: result.reason,
          attemptsRemaining: Math.max(0, result.attemptsRemaining),
          canResend: result.reason !== 'incorrect' || result.attemptsRemaining <= 0,
        },
        { status: 400 },
      );
    }

    const now = new Date();

    /**
     * Activation.
     *
     * PATCH with a field mask, so nothing already on the document is touched.
     * The `users/{uid}` bootstrap in `src/firebase/provider.tsx` runs off
     * `onAuthStateChanged` and races this one in principle — it takes a human
     * several seconds to read an email and type six digits, so in practice it
     * has always finished. The profile fields below are the belt: if this
     * write lands first and creates the document, the provider's
     * `exists()` check would skip the bootstrap and leave a profile with no
     * name and no role.
     */
    const activation: Record<string, unknown> = {
      emailVerified: true,
      emailVerifiedAt: now,
      emailVerificationProof: verificationProof(secret, uid, email),
    };

    if (!user) {
      Object.assign(activation, {
        email,
        name: tokenName ?? '',
        displayName: tokenName ?? '',
        role: 'buyer',
        status: 'active',
        createdAt: now,
        lastLoginAt: now,
      });
    }

    await firestoreUpdate('users', uid, activation, idToken);

    // Burn the challenge. Cleared rather than deleted: an empty `codeHash`
    // reads as "no active code" to `checkOtp`, `consumedAt` leaves a trail for
    // support, and neither needs a delete rule in firestore.rules.
    await firestoreUpdate(
      'email_verifications',
      uid,
      { codeHash: '', consumedAt: now, attempts: 0 },
      idToken,
    ).catch((err) => console.error('[otp] challenge cleanup failed:', err?.message ?? err));

    return NextResponse.json({ success: true, verified: true });
  } catch (err: any) {
    console.error('[otp] verify-otp error:', err?.message ?? err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
