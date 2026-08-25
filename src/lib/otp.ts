/**
 * Email one-time passcodes (6 digits) for account activation.
 *
 * Pure and server-only: no Firestore, no network, no env read at module scope
 * (CI builds with placeholder env — see CLAUDE.md §11). The API routes supply
 * the secret and own the storage; everything decidable without I/O lives here
 * so it can be tested directly.
 *
 * ## Why the codes are HMAC'd rather than hashed
 *
 * A 6-digit code has a million possibilities. A plain SHA-256 of one is
 * reversed by a laptop in well under a second, so storing `sha256(code)` in a
 * document the account owner can read is the same as storing the code. Every
 * digest here is an **HMAC keyed with `OTP_SECRET`**, which the client never
 * sees — without the key there is nothing to brute-force against, so the
 * challenge document stays harmless even though Firestore rules must let the
 * owner read it (the server talks to Firestore with *the user's own* token —
 * see below).
 *
 * ## Why a verification "proof" exists at all
 *
 * This app has no service-account key: `src/lib/firebase-admin.ts` verifies ID
 * tokens against Google's JWKS and every server write goes through the
 * Firestore REST API carrying the caller's token. The server therefore has
 * *exactly* the privileges of the signed-in user, and cannot write a field the
 * user could not write themselves from the browser console. `emailVerified`
 * on the user document is consequently a UI hint, not evidence.
 *
 * `verificationProof()` is the evidence: an HMAC over `uid|email` that only a
 * holder of `OTP_SECRET` can produce. Server code that needs a real guarantee
 * calls `hasVerifiedEmail()`, which recomputes it, instead of trusting the
 * boolean beside it. Flipping `emailVerified` by hand gets an attacker a
 * green tick in their own UI and nothing else.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Digits in a code. Six is the ceiling for "read it off the screen and type
 *  it"; the brute-force margin comes from expiry and the attempt caps below,
 *  not from length. */
export const OTP_LENGTH = 6;

/** How long a code stays valid. Long enough for a slow inbox, short enough
 *  that the guessing window stays small. */
export const OTP_TTL_MINUTES = 10;

/** Wrong guesses allowed against one code before it is burned. */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum gap between two sends to the same account, in seconds. Stops a
 *  held-down "Resend" button from turning into a mail bomb. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Codes issued per account per TTL window, across resends. */
export const OTP_MAX_SENDS_PER_WINDOW = 5;

export const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

/**
 * A fresh code.
 *
 * `randomInt` is the CSPRNG and is uniform over the range — `Math.random()`
 * is neither, and `% 1000000` on a raw byte draw is biased. Leading zeros are
 * preserved by padding, so "004821" is a legal code and the space really is
 * 10^6 rather than 9·10^5.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** Digits only, whitespace and separators stripped — people paste "123 456"
 *  and "123-456" out of their mail client. */
export function normalizeOtp(input: string): string {
  return (input ?? '').replace(/\D+/g, '');
}

export function isWellFormedOtp(input: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(input ?? '');
}

/** Addresses are compared case-insensitively and trimmed, because that is how
 *  they arrive from a form and how Firebase stores them. */
export function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

function hmac(secret: string, parts: string[]): string {
  return createHmac('sha256', secret).update(parts.join('|')).digest('hex');
}

/**
 * The digest stored on the challenge document.
 *
 * `uid` and `email` are inside the MAC, not just the code, so a digest lifted
 * from one account cannot be replayed against another, and a code stops
 * matching the moment the address it was sent to changes.
 */
export function hashOtp(secret: string, uid: string, email: string, code: string): string {
  return hmac(secret, ['otp', uid, normalizeEmail(email), normalizeOtp(code)]);
}

/**
 * Unforgeable record that this address was confirmed by whoever holds it.
 * Bound to the address, so changing the account's email invalidates it.
 */
export function verificationProof(secret: string, uid: string, email: string): string {
  return hmac(secret, ['verified', uid, normalizeEmail(email)]);
}

/**
 * Constant-time digest comparison.
 *
 * `===` on hex strings returns as soon as two characters differ, which leaks
 * how much of the digest was right. `timingSafeEqual` throws on a length
 * mismatch, so that case is answered before the call rather than by it.
 */
export function digestsMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Does this user document carry a genuine confirmation for this address?
 *
 * The check server code should make. Reading `user.emailVerified` instead
 * trusts a field its owner can set (see the module header).
 */
export function hasVerifiedEmail(
  secret: string,
  uid: string,
  email: string,
  user: { emailVerificationProof?: unknown } | null | undefined,
): boolean {
  const proof = user?.emailVerificationProof;
  if (typeof proof !== 'string' || !proof) return false;
  return digestsMatch(proof, verificationProof(secret, uid, email));
}

// ── Challenge state ─────────────────────────────────────────────────────────

/** The `email_verifications/{uid}` document, as far as this module cares. */
export interface OtpChallenge {
  codeHash?: string;
  email?: string;
  /** ISO 8601 — Firestore REST returns timestamps as strings. */
  expiresAt?: string;
  sentAt?: string;
  attempts?: number;
  sendCount?: number;
  windowStartedAt?: string;
  consumedAt?: string;
}

export type OtpFailure =
  | 'no_challenge'
  | 'expired'
  | 'too_many_attempts'
  | 'email_changed'
  | 'incorrect';

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: OtpFailure; attemptsRemaining: number };

function ms(iso?: string): number {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Decide a submitted code against a stored challenge.
 *
 * Ordered so a burned or stale challenge is rejected before the code is even
 * compared: there is no reason to spend a comparison on a challenge that
 * cannot succeed, and answering "expired" rather than "incorrect" is the
 * difference between the user pressing Resend and the user retyping.
 */
export function checkOtp(
  secret: string,
  uid: string,
  email: string,
  submitted: string,
  challenge: OtpChallenge | null | undefined,
  now = Date.now(),
): OtpCheck {
  const attempts = Number(challenge?.attempts ?? 0);
  const remaining = Math.max(0, OTP_MAX_ATTEMPTS - attempts);

  if (!challenge?.codeHash || challenge.consumedAt) {
    return { ok: false, reason: 'no_challenge', attemptsRemaining: 0 };
  }
  if (ms(challenge.expiresAt) <= now) {
    return { ok: false, reason: 'expired', attemptsRemaining: 0 };
  }
  if (attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts', attemptsRemaining: 0 };
  }
  // The code was mailed to whatever address the challenge recorded. If the
  // account's address has moved since, the person reading that inbox is no
  // longer necessarily the person signing in.
  if (challenge.email && normalizeEmail(challenge.email) !== normalizeEmail(email)) {
    return { ok: false, reason: 'email_changed', attemptsRemaining: 0 };
  }
  if (!isWellFormedOtp(normalizeOtp(submitted))) {
    return { ok: false, reason: 'incorrect', attemptsRemaining: remaining - 1 };
  }
  if (!digestsMatch(challenge.codeHash, hashOtp(secret, uid, email, submitted))) {
    return { ok: false, reason: 'incorrect', attemptsRemaining: remaining - 1 };
  }
  return { ok: true };
}

export type SendGate =
  | { allowed: true; sendCount: number; windowStartedAt: string }
  | { allowed: false; reason: 'cooldown' | 'too_many_sends'; retryAfterSeconds: number };

/**
 * May another code be sent right now?
 *
 * Two limits with different jobs: the cooldown makes a double-click harmless,
 * the window cap makes a script pointed at someone else's inbox pointless.
 * The window rolls forward once it lapses, so a legitimate user who comes back
 * an hour later starts fresh instead of staying locked out.
 */
export function canSendOtp(challenge: OtpChallenge | null | undefined, now = Date.now()): SendGate {
  const sentAt = ms(challenge?.sentAt);
  const sinceSend = now - sentAt;
  if (sentAt && sinceSend < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - sinceSend) / 1000),
    };
  }

  const windowStart = ms(challenge?.windowStartedAt);
  const windowLive = windowStart > 0 && now - windowStart < OTP_TTL_MS;
  const sendCount = windowLive ? Number(challenge?.sendCount ?? 0) : 0;

  if (windowLive && sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'too_many_sends',
      retryAfterSeconds: Math.ceil((windowStart + OTP_TTL_MS - now) / 1000),
    };
  }

  return {
    allowed: true,
    sendCount: sendCount + 1,
    windowStartedAt: windowLive ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
  };
}

/**
 * The signing key.
 *
 * A function, never a module-scope read: this module is imported during
 * `next build` page-data collection, and throwing at import time would fail
 * the build before any route runs (the same reason `assertFirebaseConfig()` is
 * a function — CLAUDE.md §13).
 */
export function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.RESET_SERVICE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'OTP_SECRET is missing or too short (needs 16+ characters). ' +
        'Generate one with `openssl rand -hex 32` and add it to .env.local and to Vercel.',
    );
  }
  return secret;
}
