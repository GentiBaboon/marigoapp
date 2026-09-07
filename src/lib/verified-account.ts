/**
 * Server-side gate: has this caller confirmed their email address?
 *
 * Applied by every API route that spends something on the caller's behalf —
 * an order, a payment intent, a conversation, an upload. The sign-up form and
 * `RequireVerifiedEmail` (client) turn people back earlier with a nicer
 * screen, but those run in the browser and can be skipped; this cannot.
 *
 * Two kinds of evidence are accepted, in this order:
 *
 * 1. **`email_verified: true` on the ID token.** Firebase sets it for Google
 *    and Apple sign-ins, whose providers vouch for the address, and the claim
 *    is inside the signed token. Costs no read.
 * 2. **`emailVerificationProof` on `users/{uid}`**, recomputed by
 *    `hasVerifiedEmail()` — the record the 6-digit code flow writes. The
 *    boolean `emailVerified` beside it is never consulted: its owner can set
 *    it (CLAUDE.md §6b).
 *
 * A missing signing secret fails **closed**. With no secret nobody can have
 * verified, so refusing is the only answer consistent with the OTP routes,
 * which 500 in the same state — and it cannot happen in a deployment where
 * sign-up works at all.
 */
import type { JWTPayload } from 'jose';
import { firestoreGet } from './firebase-admin';
import { getOtpSecret, hasVerifiedEmail, normalizeEmail } from './otp';

/** The `reason` on a refusal. Clients route on it, so it is a constant. */
export const EMAIL_UNVERIFIED_REASON = 'email_unverified' as const;

/** Where a refused caller should be sent. Same value the client gate uses. */
export const VERIFY_EMAIL_PATH = '/auth/verify-email';

export const EMAIL_UNVERIFIED_MESSAGE =
  'Confirm your email address to continue. We have sent you a 6-digit code.';

type Token = JWTPayload & { uid?: string; sub: string; email?: unknown; email_verified?: unknown };

export type VerifiedCheck =
  | { ok: true }
  | { ok: false; status: 403 | 503; body: { error: string; reason: string; verifyPath?: string } };

/** True when the identity provider itself vouched for the address. */
export function isEmailVerifiedToken(token: Token): boolean {
  return token.email_verified === true && typeof token.email === 'string' && token.email.length > 0;
}

/**
 * Decide, reading `users/{uid}` only when the token alone cannot answer.
 *
 * `user` may be passed by a route that has already fetched the document, to
 * save the read; when omitted it is fetched with the caller's own token.
 */
export async function checkVerifiedEmail(
  token: Token,
  idToken: string,
  user?: Record<string, unknown> | null,
): Promise<VerifiedCheck> {
  if (isEmailVerifiedToken(token)) return { ok: true };

  const uid = String(token.uid || token.sub || '');
  const email = normalizeEmail(String(token.email ?? ''));

  const refusal: VerifiedCheck = {
    ok: false,
    status: 403,
    body: { error: EMAIL_UNVERIFIED_MESSAGE, reason: EMAIL_UNVERIFIED_REASON, verifyPath: VERIFY_EMAIL_PATH },
  };
  if (!uid || !email) return refusal;

  let secret: string;
  try {
    secret = getOtpSecret();
  } catch (err: any) {
    console.error('[verified-account] not configured:', err?.message ?? err);
    return {
      ok: false,
      status: 503,
      body: { error: 'Email verification is not configured.', reason: 'not_configured' },
    };
  }

  const doc = user === undefined ? await firestoreGet('users', uid, idToken).catch(() => null) : user;
  return hasVerifiedEmail(secret, uid, email, doc ?? null) ? { ok: true } : refusal;
}
