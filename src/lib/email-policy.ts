/**
 * Which addresses may open an account.
 *
 * Three places ask, and they must agree:
 *
 * 1. The sign-up form, through `signupSchema` (`src/lib/types.ts`) — the
 *    friendly layer: the address is refused before Firebase is asked to
 *    create anything.
 * 2. `/api/auth/send-otp` — the layer that holds on the web. Account creation
 *    is a client-side Firebase call this server never sees, so someone who
 *    scripts around the form still gets an account; what they cannot get is
 *    an activation code, and an unactivated account is refused by every
 *    route that spends money (`src/lib/verified-account.ts`).
 * 3. `blockDisposableSignups` in `functions/src/index.ts` — refuses creation
 *    itself, before the account exists. Live since 2026-09-07 (CLAUDE.md
 *    §6b); layers 1 and 2 remain for a domain that reaches the list later
 *    than the deploy.
 *
 * The domain list lives in `src/lib/disposable-email-domains.ts`; see the
 * note there about its twin in `functions/`.
 */
import { emailDomain, isDisposableEmailDomain } from './disposable-email-domains';

export { emailDomain, isDisposableEmailDomain } from './disposable-email-domains';

/** Shown by the form and returned by the route. One sentence, no jargon —
 *  the person reading it is mid-sign-up and just wants to know what to do. */
export const DISPOSABLE_EMAIL_MESSAGE =
  'Temporary or disposable email addresses cannot be used. Please sign up with an address you keep.';

export function isDisposableEmail(email: string): boolean {
  return isDisposableEmailDomain(emailDomain(email));
}

/** `null` when the address is acceptable, otherwise the message to show. */
export function emailPolicyError(email: string): string | null {
  return isDisposableEmail(email) ? DISPOSABLE_EMAIL_MESSAGE : null;
}
