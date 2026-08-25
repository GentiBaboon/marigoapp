/**
 * POST /api/auth/send-otp — mail a fresh 6-digit activation code.
 *
 * Authorization: Bearer <Firebase ID token>. The account must already exist in
 * Firebase Auth; this route confirms the address on it, so there is nothing
 * useful an anonymous caller could do here and plenty they could abuse (every
 * call sends an email).
 *
 * The address is taken from the **token's `email` claim**, never from the
 * request body. A body-supplied address would let a signed-in user aim
 * Marigo's mail at anyone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { otpSendLimiter, applyRateLimit } from '@/lib/rate-limit';
import { sendEmailOtp } from '@/lib/email';
import {
  canSendOtp,
  generateOtp,
  getOtpSecret,
  hasVerifiedEmail,
  hashOtp,
  normalizeEmail,
  OTP_TTL_MINUTES,
  OTP_TTL_MS,
  type OtpChallenge,
} from '@/lib/otp';

export const runtime = 'nodejs';

function bearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, otpSendLimiter);
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
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  if (!uid || !email) {
    // A token with no email claim means a sign-in method that carries no
    // address (anonymous, phone). There is nothing to send a code to.
    return NextResponse.json({ error: 'This account has no email address.' }, { status: 400 });
  }

  let secret: string;
  try {
    secret = getOtpSecret();
  } catch (err: any) {
    console.error('[otp] not configured:', err?.message ?? err);
    return NextResponse.json({ error: 'Verification is not configured.' }, { status: 500 });
  }

  try {
    // Already confirmed? Say so instead of sending a code the UI would then
    // have to explain. `hasVerifiedEmail` recomputes the proof rather than
    // reading the boolean beside it — see src/lib/otp.ts.
    const user = await firestoreGet('users', uid, idToken);
    if (hasVerifiedEmail(secret, uid, email, user)) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const challenge = (await firestoreGet('email_verifications', uid, idToken)) as OtpChallenge | null;
    const gate = canSendOtp(challenge);
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error:
            gate.reason === 'cooldown'
              ? `Please wait ${gate.retryAfterSeconds}s before requesting another code.`
              : 'Too many codes requested. Try again later.',
          retryAfterSeconds: gate.retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(gate.retryAfterSeconds) } },
      );
    }

    const code = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    // Stored before it is sent. The other order risks mailing a code the
    // server has no record of, which reads to the user as "the code doesn't
    // work" with nothing in the logs to explain it.
    await firestoreUpdate(
      'email_verifications',
      uid,
      {
        codeHash: hashOtp(secret, uid, email, code),
        email,
        expiresAt,
        sentAt: now,
        attempts: 0,
        sendCount: gate.sendCount,
        windowStartedAt: new Date(gate.windowStartedAt),
        consumedAt: '',
      },
      idToken,
    );

    const result = await sendEmailOtp(email, {
      name: (user?.displayName as string) || (user?.name as string) || name,
      code,
      expiresMinutes: OTP_TTL_MINUTES,
    });

    // No SENDGRID_API_KEY — local dev, CI, a preview deploy. The transport
    // skips quietly by design, so put the code where a developer can reach it.
    // The terminal, never the HTTP response: a response field is one config
    // slip away from handing every caller in production a valid code.
    if (result.skipped && process.env.NODE_ENV !== 'production') {
      console.info(`[otp] mail skipped — code for ${email} is ${code}`);
      return NextResponse.json({ success: true, delivered: false });
    }

    if (!result.ok) {
      console.error('[otp] send failed:', result.error);
      return NextResponse.json(
        { error: 'We could not send the code. Please try again in a moment.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, delivered: true, expiresInMinutes: OTP_TTL_MINUTES });
  } catch (err: any) {
    console.error('[otp] send-otp error:', err?.message ?? err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
