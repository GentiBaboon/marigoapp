/**
 * What the browser knows about whether an account's email is confirmed, and
 * which screens insist on it.
 *
 * Pure and import-free so both the hook and the tests can use it. The server
 * has its own answer in `src/lib/verified-account.ts`, which recomputes the
 * HMAC proof; the browser cannot, so it reads the two hints it does have and
 * treats them as a **convenience** gate — the API routes are the real one.
 */

/** Sent to a refused caller by the API routes; see `verified-account.ts`. */
export const EMAIL_UNVERIFIED_REASON = 'email_unverified';
export const VERIFY_EMAIL_PATH = '/auth/verify-email';

/**
 * Screens an unconfirmed account is turned away from, as path prefixes.
 *
 * These are the entry points to the actions the server refuses anyway —
 * buying, listing, editing a listing, messaging — so the person is told once,
 * on arrival, instead of at the end of a form by a 403. Browsing, favourites,
 * the cart and the profile stay open: an abandoned sign-up costs nothing
 * there, and bouncing a legacy member off their own profile for a code they
 * never needed before is the wrong first impression.
 *
 * Matched with `needsVerifiedEmail()`, which knows the native spellings too.
 */
export const VERIFICATION_GATED_PREFIXES: readonly string[] = ['/checkout', '/sell', '/messages'];

const EDIT_LISTING = /^\/products\/(?:[^/]+\/edit|edit)(?:\/|$)/;

export function needsVerifiedEmail(pathname: string): boolean {
  const path = (pathname ?? '').split('?')[0];
  if (EDIT_LISTING.test(path)) return true;
  return VERIFICATION_GATED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Verified as far as the browser can tell.
 *
 * `authEmailVerified` is `User.emailVerified` from Firebase Auth — true for
 * Google and Apple accounts, whose provider vouched for the address. The
 * document flag is what the 6-digit code flow writes. Either suffices;
 * `undefined` on both (an account from before the code existed) is "not
 * verified", which sends that member through the code once.
 */
export function isEmailVerifiedClient(
  authEmailVerified: boolean | null | undefined,
  userDoc: { emailVerified?: unknown } | null | undefined,
): boolean {
  return authEmailVerified === true || userDoc?.emailVerified === true;
}

/**
 * The verify screen, carrying where to go afterwards.
 *
 * Only a same-origin path is kept — `//evil.example` is protocol-relative and
 * would be an open redirect. Anything else, or nothing, lands on /home.
 */
export function verifyEmailHref(next?: string | null): string {
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith(VERIFY_EMAIL_PATH) ? next : '';
  return safe ? `${VERIFY_EMAIL_PATH}?next=${encodeURIComponent(safe)}` : VERIFY_EMAIL_PATH;
}

/** Did an API route refuse for want of a confirmed address? */
export function isEmailUnverifiedResponse(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as { reason?: unknown }).reason === EMAIL_UNVERIFIED_REASON;
}
