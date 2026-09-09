import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  isEmailUnverifiedResponse,
  isEmailVerifiedClient,
  needsVerifiedEmail,
  verifyEmailHref,
  VERIFY_EMAIL_PATH,
} from '@/lib/account-verification';
import { verificationProof } from '@/lib/otp';

const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  firestoreGet: (...a: any[]) => mockGet(...a),
}));

import { checkAccountAccess, checkAccountStanding, checkVerifiedEmail, EMAIL_UNVERIFIED_REASON } from '@/lib/verified-account';
import { ACCOUNT_BANNED_REASON, isAccountBannedResponse, isBannedDoc, SUSPENDED_MESSAGE } from '@/lib/account-verification';

const ROOT = resolve(__dirname, '../../..');
const SECRET = 'a-secret-long-enough-for-the-check';

describe('needsVerifiedEmail', () => {
  it('gates the entry points to buying, listing, editing and messaging', () => {
    for (const p of ['/checkout', '/checkout/', '/sell', '/messages', '/messages/abc', '/messages/view/?conversationId=c1']) {
      expect(needsVerifiedEmail(p), p).toBe(true);
    }
    expect(needsVerifiedEmail('/products/abc/edit')).toBe(true);
    expect(needsVerifiedEmail('/products/edit/?id=abc')).toBe(true);
  });
  it('leaves browsing, the cart, favourites and the profile open', () => {
    for (const p of ['/', '/home', '/cart', '/favorites', '/profile', '/profile/listings', '/products/abc', '/products/view/?id=abc', '/sellers', '/checkoutx']) {
      expect(needsVerifiedEmail(p), p).toBe(false);
    }
  });
});

describe('isEmailVerifiedClient', () => {
  it('accepts the provider flag or the document flag, and nothing else', () => {
    expect(isEmailVerifiedClient(true, null)).toBe(true);
    expect(isEmailVerifiedClient(false, { emailVerified: true })).toBe(true);
    expect(isEmailVerifiedClient(false, { emailVerified: false })).toBe(false);
    expect(isEmailVerifiedClient(undefined, undefined)).toBe(false);
    expect(isEmailVerifiedClient(false, { emailVerified: 'true' })).toBe(false);
  });
  it('exempts operator roles, which a member cannot self-assign', () => {
    expect(isEmailVerifiedClient(false, { role: 'admin' })).toBe(true);
    expect(isEmailVerifiedClient(false, { role: 'super_admin' })).toBe(true);
    expect(isEmailVerifiedClient(false, { role: 'seller' })).toBe(false);
    expect(isEmailVerifiedClient(false, { role: 'buyer' })).toBe(false);
  });
});

describe('verifyEmailHref', () => {
  it('carries a same-origin destination', () => {
    expect(verifyEmailHref('/checkout')).toBe(`${VERIFY_EMAIL_PATH}?next=%2Fcheckout`);
  });
  it('drops anything that could leave the site, and itself', () => {
    expect(verifyEmailHref('//evil.example')).toBe(VERIFY_EMAIL_PATH);
    expect(verifyEmailHref('https://evil.example')).toBe(VERIFY_EMAIL_PATH);
    expect(verifyEmailHref(VERIFY_EMAIL_PATH)).toBe(VERIFY_EMAIL_PATH);
    expect(verifyEmailHref(null)).toBe(VERIFY_EMAIL_PATH);
  });
});

describe('isEmailUnverifiedResponse', () => {
  it('recognises the route refusal and nothing else', () => {
    expect(isEmailUnverifiedResponse({ reason: EMAIL_UNVERIFIED_REASON })).toBe(true);
    expect(isEmailUnverifiedResponse({ error: 'x' })).toBe(false);
    expect(isEmailUnverifiedResponse(null)).toBe(false);
  });
});

describe('checkVerifiedEmail (server)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    process.env.OTP_SECRET = SECRET;
  });

  const token = (extra: Record<string, unknown>) => ({ sub: 'u1', uid: 'u1', email: 'a@b.com', ...extra }) as any;

  it('trusts a provider-verified token without a read', async () => {
    const r = await checkVerifiedEmail(token({ email_verified: true }), 'tok');
    expect(r.ok).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('accepts a genuine proof on the user document', async () => {
    mockGet.mockResolvedValue({ emailVerificationProof: verificationProof(SECRET, 'u1', 'a@b.com') });
    const r = await checkVerifiedEmail(token({ email_verified: false }), 'tok');
    expect(r.ok).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('users', 'u1', 'tok');
  });

  it('ignores the self-settable boolean', async () => {
    mockGet.mockResolvedValue({ emailVerified: true });
    const r = await checkVerifiedEmail(token({ email_verified: false }), 'tok');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe(EMAIL_UNVERIFIED_REASON);
      expect(r.body.verifyPath).toBe(VERIFY_EMAIL_PATH);
    }
  });

  it('lets an operator through on their stored role alone', async () => {
    mockGet.mockResolvedValue({ role: 'admin', emailVerified: false });
    const r = await checkVerifiedEmail(token({ email_verified: false }), 'tok');
    expect(r.ok).toBe(true);
  });

  it('refuses a proof minted for another address', async () => {
    mockGet.mockResolvedValue({ emailVerificationProof: verificationProof(SECRET, 'u1', 'other@b.com') });
    const r = await checkVerifiedEmail(token({}), 'tok');
    expect(r.ok).toBe(false);
  });

  it('uses a document the route already fetched', async () => {
    const user = { emailVerificationProof: verificationProof(SECRET, 'u1', 'a@b.com') };
    const r = await checkVerifiedEmail(token({}), 'tok', user);
    expect(r.ok).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('treats a failed read as unverified, not as an error', async () => {
    mockGet.mockRejectedValue(new Error('boom'));
    const r = await checkVerifiedEmail(token({}), 'tok');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('fails closed with no signing secret', async () => {
    delete process.env.OTP_SECRET;
    delete process.env.RESET_SERVICE_SECRET;
    const r = await checkVerifiedEmail(token({}), 'tok');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('checkAccountStanding / checkAccountAccess (server)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    process.env.OTP_SECRET = SECRET;
  });
  const token = (extra: Record<string, unknown> = {}) => ({ sub: 'u1', uid: 'u1', email: 'a@b.com', ...extra }) as any;

  it('refuses a banned account with the suspension notice', async () => {
    mockGet.mockResolvedValue({ status: 'banned', emailVerified: true });
    const r = await checkAccountStanding(token(), 'tok');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe(ACCOUNT_BANNED_REASON);
      expect(r.body.error).toBe(SUSPENDED_MESSAGE);
      expect(isAccountBannedResponse(r.body)).toBe(true);
    }
  });

  it('passes an active account and hands the document on', async () => {
    mockGet.mockResolvedValue({ status: 'active' });
    const r = await checkAccountStanding(token(), 'tok');
    expect(r.ok).toBe(true);
    if (r.ok) expect((r as any).user).toEqual({ status: 'active' });
  });

  it('bans outrank a verified provider token', async () => {
    mockGet.mockResolvedValue({ status: 'banned' });
    const r = await checkAccountAccess(token({ email_verified: true }), 'tok');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.reason).toBe(ACCOUNT_BANNED_REASON);
  });

  it('reads the document once for both checks', async () => {
    mockGet.mockResolvedValue({ status: 'active', emailVerificationProof: verificationProof(SECRET, 'u1', 'a@b.com') });
    const r = await checkAccountAccess(token(), 'tok');
    expect(r.ok).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('isBannedDoc only trusts the exact status', () => {
    expect(isBannedDoc({ status: 'banned' })).toBe(true);
    expect(isBannedDoc({ status: 'active' })).toBe(false);
    expect(isBannedDoc(null)).toBe(false);
  });
});

describe('every Bearer route refuses a banned caller', () => {
  // Rules stop a banned member's Firestore writes, but several routes spend
  // before they write — a Stripe intent, an upload, a model call, an email.
  // Listing them by name means a new Bearer route without the check fails a
  // test rather than being found by the next banned account.
  const BEARER = [
    'ai/draft-listing', 'ai/suggest-price', 'auth/send-otp', 'auth/verify-otp', 'auth/welcome', 'confirm-order',
    'create-order', 'create-payment-intent', 'offers/notify', 'orders/notify',
    'start-conversation', 'stripe/create-connected-account', 'upload',
  ];
  it.each(BEARER)('/api/%s calls checkAccountStanding or checkAccountAccess', (name) => {
    const src = readFileSync(join(ROOT, 'src/app/api', name, 'route.ts'), 'utf8');
    expect(src).toMatch(/await checkAccount(Standing|Access)\(/);
  });
});

describe('every route that spends on the caller runs the gate', () => {
  // The gate is decoration unless the routes actually call it. Listing them
  // here means adding a spending route without the gate fails a test rather
  // than being noticed in production.
  const GATED = ['auth/welcome', 'create-order', 'create-payment-intent', 'start-conversation', 'upload'];
  it.each(GATED)('/api/%s calls checkAccountAccess', (name) => {
    const src = readFileSync(join(ROOT, 'src/app/api', name, 'route.ts'), 'utf8');
    expect(src).toMatch(/from '@\/lib\/verified-account'/);
    expect(src).toMatch(/await checkAccountAccess\(/);
  });
});
