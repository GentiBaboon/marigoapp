/**
 * Unsubscribe links.
 *
 * A link in an email is a URL anyone can edit, so the recipient's address
 * cannot simply sit in the query string — that would let anybody unsubscribe
 * anybody by typing a different address. Each link therefore carries an HMAC
 * of the address, and the route refuses a token whose signature does not
 * verify.
 *
 * The signing key never leaves the server, and nothing about the recipient is
 * stored: the token is self-describing, so there is no database to keep in
 * step with the mail.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { absoluteUrl } from '@/lib/site';

/**
 * Signing key. `UNSUBSCRIBE_SECRET` is the intended source; the SendGrid key is
 * a fallback so links still work on a deployment that has mail configured but
 * has not set the dedicated secret. Rotating whichever one is in use
 * invalidates links already sitting in people's inboxes, which is why a
 * dedicated secret is worth setting.
 */
function signingKey(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SENDGRID_API_KEY || null;
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(email: string, key: string): string {
  return createHmac('sha256', key).update(email.toLowerCase()).digest('hex').slice(0, 32);
}

/** `<base64url(email)>.<hmac>`, or null when no key is configured. */
export function mintUnsubscribeToken(email: string): string | null {
  const key = signingKey();
  if (!key || !email) return null;
  return `${b64url(email.toLowerCase())}.${sign(email, key)}`;
}

/** The address a token vouches for, or null if it does not verify. */
export function verifyUnsubscribeToken(token: string): string | null {
  const key = signingKey();
  if (!key || !token || !token.includes('.')) return null;

  const [encoded, provided] = token.split('.');
  let email: string;
  try {
    email = unb64url(encoded);
  } catch {
    return null;
  }
  if (!email.includes('@')) return null;

  const expected = sign(email, key);
  // Constant-time: a length-safe compare avoids leaking how much of a forged
  // signature was correct.
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

export function unsubscribeUrl(email: string): string {
  const token = mintUnsubscribeToken(email);
  return token ? absoluteUrl(`/unsubscribe?u=${encodeURIComponent(token)}`) : absoluteUrl('/unsubscribe');
}

// ─── What an unsubscribe actually stops ───────────────────────────────────────

/**
 * Categories that are sent regardless of an opt-out.
 *
 * Suppressing these would be worse than annoying — it would break account
 * recovery and leave someone with no record of money moving. Both the law
 * (CAN-SPAM, GDPR) and every mailbox provider treat transactional mail as
 * exempt from marketing consent, so the honest thing is to keep sending them
 * and to say so plainly on the unsubscribe page rather than to imply a silence
 * we are not going to honour.
 */
export const ESSENTIAL_CATEGORIES = new Set([
  'password-reset',
  'verify-email',
  'order-confirmation',
  'order-shipped',
  'order-delivered',
  'order-cancelled',
  'refund',
  'payout',
  'seller-new-order',
  'return-requested',
  'return-resolved',
  'admin-new-user',
  'admin-new-order',
  'admin-order-cancelled',
]);

/** Everything else — welcome, offers, messages, listing moderation — is
 *  optional and is what an unsubscribe silences. */
export function isEssentialCategory(category?: string): boolean {
  return !!category && ESSENTIAL_CATEGORIES.has(category);
}
