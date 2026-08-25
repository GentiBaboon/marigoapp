import { describe, it, expect } from 'vitest';
import {
  ADMIN_GATE_TTL_DAYS,
  isGateEnabled,
  isUnlockPath,
  safeEqual,
  signGateCookie,
  verifyGateCookie,
} from '@/lib/admin-gate';

const SECRET = 'gate-secret-at-least-16-chars';
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const future = (ms = 60_000) => NOW + ms;

describe('isGateEnabled', () => {
  it('is on only when both halves are present and usable', () => {
    expect(isGateEnabled({ unlockPath: '/x7k2m-console', secret: SECRET })).toBe(true);
  });

  it('is off when either half is missing', () => {
    // Failing *open* is deliberate: failing closed on missing config would
    // lock an operator out of their own panel with no way back without a
    // deploy, and "off" is the pre-existing behaviour, not a regression.
    expect(isGateEnabled({ unlockPath: '/x', secret: undefined })).toBe(false);
    expect(isGateEnabled({ unlockPath: undefined, secret: SECRET })).toBe(false);
    expect(isGateEnabled({})).toBe(false);
  });

  it('rejects a path that is not a path', () => {
    expect(isGateEnabled({ unlockPath: 'x7k2m-console', secret: SECRET })).toBe(false);
  });

  it('rejects a secret too short to be worth signing with', () => {
    expect(isGateEnabled({ unlockPath: '/x', secret: 'short' })).toBe(false);
  });
});

describe('safeEqual', () => {
  it('matches equal strings only', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('is false rather than throwing on empty or unequal lengths', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual(undefined as any, 'abc')).toBe(false);
  });
});

describe('gate cookie', () => {
  it('round-trips a freshly signed cookie', async () => {
    const cookie = await signGateCookie(SECRET, future());
    expect(await verifyGateCookie(SECRET, cookie, NOW)).toBe(true);
  });

  it('never contains the secret', async () => {
    const cookie = await signGateCookie(SECRET, future());
    expect(cookie).not.toContain(SECRET);
  });

  it('rejects a cookie signed with a different secret', async () => {
    const cookie = await signGateCookie('a-completely-different-secret', future());
    expect(await verifyGateCookie(SECRET, cookie, NOW)).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    const cookie = await signGateCookie(SECRET, NOW - 1);
    expect(await verifyGateCookie(SECRET, cookie, NOW)).toBe(false);
  });

  it('rejects an extended expiry, because the expiry is inside the MAC', async () => {
    // Otherwise anyone holding one valid cookie keeps it forever by editing
    // the timestamp.
    const cookie = await signGateCookie(SECRET, future());
    const signature = cookie.slice(cookie.lastIndexOf('.') + 1);
    const extended = `${NOW + 10 ** 12}.${signature}`;
    expect(await verifyGateCookie(SECRET, extended, NOW)).toBe(false);
  });

  it('rejects a forged signature', async () => {
    expect(await verifyGateCookie(SECRET, `${future()}.${'f'.repeat(64)}`, NOW)).toBe(false);
  });

  it('rejects junk without throwing', async () => {
    for (const junk of ['', 'nonsense', '.', 'abc.def', `${future()}.`, `.${'f'.repeat(64)}`]) {
      expect(await verifyGateCookie(SECRET, junk, NOW)).toBe(false);
    }
    expect(await verifyGateCookie(SECRET, undefined, NOW)).toBe(false);
  });

  it('issues a cookie that lasts the documented window', async () => {
    const expiresAt = NOW + ADMIN_GATE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const cookie = await signGateCookie(SECRET, expiresAt);
    expect(await verifyGateCookie(SECRET, cookie, expiresAt - 1000)).toBe(true);
    expect(await verifyGateCookie(SECRET, cookie, expiresAt + 1000)).toBe(false);
  });
});

describe('isUnlockPath', () => {
  const UNLOCK = '/mg-8f6cb942-console';

  it('matches the exact path', () => {
    expect(isUnlockPath(UNLOCK, UNLOCK)).toBe(true);
  });

  it('forgives a trailing slash and casing, which a hand-typed URL gets wrong', () => {
    expect(isUnlockPath(`${UNLOCK}/`, UNLOCK)).toBe(true);
    expect(isUnlockPath(UNLOCK.toUpperCase(), UNLOCK)).toBe(true);
  });

  it('does not match a near miss or a prefix', () => {
    expect(isUnlockPath('/mg-8f6cb942-consol', UNLOCK)).toBe(false);
    expect(isUnlockPath(`${UNLOCK}/extra`, UNLOCK)).toBe(false);
    expect(isUnlockPath('/admin', UNLOCK)).toBe(false);
    expect(isUnlockPath('/', UNLOCK)).toBe(false);
  });
});
