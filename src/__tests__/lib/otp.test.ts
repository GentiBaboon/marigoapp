import { describe, it, expect } from 'vitest';
import {
  canSendOtp,
  checkOtp,
  digestsMatch,
  generateOtp,
  hasVerifiedEmail,
  hashOtp,
  isWellFormedOtp,
  normalizeEmail,
  normalizeOtp,
  verificationProof,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MS,
  type OtpChallenge,
} from '@/lib/otp';

const SECRET = 'test-secret-at-least-16-chars-long';
const UID = 'user-123';
const EMAIL = 'buyer@example.com';

const iso = (t: number) => new Date(t).toISOString();

/** A challenge that is valid at `now`, carrying `code`. */
function challengeFor(code: string, now: number, over: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    codeHash: hashOtp(SECRET, UID, EMAIL, code),
    email: EMAIL,
    expiresAt: iso(now + OTP_TTL_MS),
    sentAt: iso(now),
    attempts: 0,
    sendCount: 1,
    windowStartedAt: iso(now),
    ...over,
  };
}

describe('generateOtp', () => {
  it('is always exactly six digits', () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('can produce codes with leading zeros', () => {
    // The whole point of padding: without it the space is 9·10^5, not 10^6,
    // and every code starting 0 is impossible.
    const codes = Array.from({ length: 4000 }, generateOtp);
    expect(codes.some((c) => c.startsWith('0'))).toBe(true);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 200 }, generateOtp));
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe('normalizeOtp / isWellFormedOtp', () => {
  it('strips the spacing mail clients introduce', () => {
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('123-456')).toBe('123456');
    expect(normalizeOtp(' 123456\n')).toBe('123456');
  });

  it('rejects anything that is not six digits', () => {
    expect(isWellFormedOtp('123456')).toBe(true);
    expect(isWellFormedOtp('12345')).toBe(false);
    expect(isWellFormedOtp('1234567')).toBe(false);
    expect(isWellFormedOtp('12345a')).toBe(false);
    expect(isWellFormedOtp('')).toBe(false);
  });
});

describe('hashOtp', () => {
  it('is stable for the same inputs', () => {
    expect(hashOtp(SECRET, UID, EMAIL, '123456')).toBe(hashOtp(SECRET, UID, EMAIL, '123456'));
  });

  it('never stores the code itself', () => {
    expect(hashOtp(SECRET, UID, EMAIL, '123456')).not.toContain('123456');
  });

  it('binds the digest to the account, so it cannot be replayed elsewhere', () => {
    expect(hashOtp(SECRET, UID, EMAIL, '123456')).not.toBe(
      hashOtp(SECRET, 'other-uid', EMAIL, '123456'),
    );
    expect(hashOtp(SECRET, UID, EMAIL, '123456')).not.toBe(
      hashOtp(SECRET, UID, 'someone@else.com', '123456'),
    );
  });

  it('is useless to an attacker without the key', () => {
    // The reason the challenge document may be readable by its owner: a
    // digest under a different key matches nothing.
    expect(hashOtp('a-totally-different-secret', UID, EMAIL, '123456')).not.toBe(
      hashOtp(SECRET, UID, EMAIL, '123456'),
    );
  });

  it('ignores the spacing a user pastes', () => {
    expect(hashOtp(SECRET, UID, EMAIL, '123 456')).toBe(hashOtp(SECRET, UID, EMAIL, '123456'));
  });

  it('treats addresses case-insensitively', () => {
    expect(hashOtp(SECRET, UID, 'Buyer@Example.COM', '123456')).toBe(
      hashOtp(SECRET, UID, EMAIL, '123456'),
    );
  });
});

describe('digestsMatch', () => {
  it('matches identical digests and nothing else', () => {
    expect(digestsMatch('abc123', 'abc123')).toBe(true);
    expect(digestsMatch('abc123', 'abc124')).toBe(false);
  });

  it('is false for empty or mismatched lengths rather than throwing', () => {
    // timingSafeEqual throws on unequal lengths; that must never reach a route.
    expect(digestsMatch('', '')).toBe(false);
    expect(digestsMatch('abc', 'abcdef')).toBe(false);
    expect(digestsMatch(undefined as any, 'abc')).toBe(false);
  });
});

describe('checkOtp', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('accepts the right code', () => {
    expect(checkOtp(SECRET, UID, EMAIL, '123456', challengeFor('123456', now), now)).toEqual({
      ok: true,
    });
  });

  it('accepts it with the spacing left in', () => {
    expect(checkOtp(SECRET, UID, EMAIL, '123 456', challengeFor('123456', now), now).ok).toBe(true);
  });

  it('rejects the wrong code and spends an attempt', () => {
    const result = checkOtp(SECRET, UID, EMAIL, '999999', challengeFor('123456', now), now);
    expect(result).toMatchObject({ ok: false, reason: 'incorrect' });
    expect(result.ok === false && result.attemptsRemaining).toBe(OTP_MAX_ATTEMPTS - 1);
  });

  it('rejects a code from a different account', () => {
    const theirs = challengeFor('123456', now);
    expect(checkOtp(SECRET, 'someone-else', EMAIL, '123456', theirs, now).ok).toBe(false);
  });

  it('reports an expired challenge as expired, not incorrect', () => {
    // The distinction drives the UI: "expired" points at Resend, "incorrect"
    // points back at the keypad.
    const stale = challengeFor('123456', now, { expiresAt: iso(now - 1) });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', stale, now)).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('expires exactly at the boundary', () => {
    const c = challengeFor('123456', now, { expiresAt: iso(now) });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', c, now)).toMatchObject({ reason: 'expired' });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', c, now - 1).ok).toBe(true);
  });

  it('stops accepting once the attempt cap is reached — even with the right code', () => {
    const burned = challengeFor('123456', now, { attempts: OTP_MAX_ATTEMPTS });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', burned, now)).toMatchObject({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('rejects a consumed challenge, so a code cannot be replayed', () => {
    const spent = challengeFor('123456', now, { consumedAt: iso(now) });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', spent, now)).toMatchObject({
      reason: 'no_challenge',
    });
  });

  it('rejects a cleared challenge', () => {
    const cleared = challengeFor('123456', now, { codeHash: '' });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', cleared, now)).toMatchObject({
      reason: 'no_challenge',
    });
  });

  it('rejects a missing challenge', () => {
    expect(checkOtp(SECRET, UID, EMAIL, '123456', null, now)).toMatchObject({
      reason: 'no_challenge',
    });
  });

  it('refuses a code mailed to a different address', () => {
    const c = challengeFor('123456', now, { email: 'old@example.com' });
    expect(checkOtp(SECRET, UID, EMAIL, '123456', c, now)).toMatchObject({
      reason: 'email_changed',
    });
  });

  it('rejects malformed input without touching the digest', () => {
    expect(checkOtp(SECRET, UID, EMAIL, 'abcdef', challengeFor('123456', now), now)).toMatchObject({
      reason: 'incorrect',
    });
    expect(checkOtp(SECRET, UID, EMAIL, '', challengeFor('123456', now), now)).toMatchObject({
      reason: 'incorrect',
    });
  });
});

describe('canSendOtp', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('allows the first send', () => {
    expect(canSendOtp(null, now)).toMatchObject({ allowed: true, sendCount: 1 });
  });

  it('holds a resend inside the cooldown', () => {
    const c = challengeFor('123456', now - 5_000);
    const gate = canSendOtp(c, now);
    expect(gate.allowed).toBe(false);
    expect(gate.allowed === false && gate.reason).toBe('cooldown');
    expect(gate.allowed === false && gate.retryAfterSeconds).toBe(OTP_RESEND_COOLDOWN_SECONDS - 5);
  });

  it('allows a resend once the cooldown lapses', () => {
    const c = challengeFor('123456', now - (OTP_RESEND_COOLDOWN_SECONDS + 1) * 1000);
    expect(canSendOtp(c, now)).toMatchObject({ allowed: true, sendCount: 2 });
  });

  it('caps sends within one window', () => {
    const windowStart = now - OTP_TTL_MS / 2;
    const c = challengeFor('123456', now - 120_000, {
      sendCount: OTP_MAX_SENDS_PER_WINDOW,
      windowStartedAt: iso(windowStart),
    });
    expect(canSendOtp(c, now)).toMatchObject({ allowed: false, reason: 'too_many_sends' });
  });

  it('rolls the window forward, so a lockout is never permanent', () => {
    const c = challengeFor('123456', now - OTP_TTL_MS * 2, {
      sendCount: OTP_MAX_SENDS_PER_WINDOW,
      windowStartedAt: iso(now - OTP_TTL_MS * 2),
    });
    expect(canSendOtp(c, now)).toMatchObject({ allowed: true, sendCount: 1 });
  });
});

describe('hasVerifiedEmail', () => {
  it('accepts a genuine proof', () => {
    const user = { emailVerificationProof: verificationProof(SECRET, UID, EMAIL) };
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, user)).toBe(true);
  });

  it('ignores emailVerified: true with no proof behind it', () => {
    // The reason the proof exists. The server writes Firestore with the
    // caller's own token, so the boolean is within its subject's reach —
    // an HMAC keyed with OTP_SECRET is not.
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, { emailVerified: true } as any)).toBe(false);
  });

  it('rejects a forged proof', () => {
    const forged = { emailVerificationProof: 'f'.repeat(64) };
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, forged)).toBe(false);
  });

  it('rejects a proof lifted from another account', () => {
    const stolen = { emailVerificationProof: verificationProof(SECRET, 'other-uid', EMAIL) };
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, stolen)).toBe(false);
  });

  it('stops being valid when the address changes', () => {
    const user = { emailVerificationProof: verificationProof(SECRET, UID, EMAIL) };
    expect(hasVerifiedEmail(SECRET, UID, 'new@example.com', user)).toBe(false);
  });

  it('is false for a missing or empty user document', () => {
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, null)).toBe(false);
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, {})).toBe(false);
    expect(hasVerifiedEmail(SECRET, UID, EMAIL, { emailVerificationProof: '' })).toBe(false);
  });

  it('is unaffected by address casing', () => {
    const user = { emailVerificationProof: verificationProof(SECRET, UID, EMAIL) };
    expect(hasVerifiedEmail(SECRET, UID, 'BUYER@EXAMPLE.com', user)).toBe(true);
  });
});

describe('constants', () => {
  it('describes a six-digit code', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(normalizeEmail('  A@B.COM ')).toBe('a@b.com');
  });
});
