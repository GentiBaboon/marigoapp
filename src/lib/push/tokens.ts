/**
 * @fileOverview Where a device's push token is stored, and what counts as one.
 *
 * Split out from the registration flow because it is the part with rules
 * attached and no I/O: the path has to agree with `firestore.rules` and with
 * the Cloud Function that reads it back, and the id has to be a legal Firestore
 * document id. Both are easy to get subtly wrong and neither shows up until a
 * device is in front of you.
 */

/** Subcollection under the owner's user document. */
export const PUSH_TOKENS_COLLECTION = 'pushTokens';

/**
 * Push tokens live in an owner-only subcollection, never on `users/{uid}`.
 *
 * That document is world-readable (`allow get: if true` — the public seller
 * profile is built from it), so a token written there would hand every visitor
 * a per-device identifier for every member, and a way to enumerate who has the
 * app installed. The subcollection is owner-read/write; the Cloud Function that
 * sends notifications reads it with admin credentials, which bypass rules.
 */
export function pushTokenPath(userId: string, token: string): string {
  return `users/${userId}/${PUSH_TOKENS_COLLECTION}/${token}`;
}

/**
 * Whether a token can be used as the document id that stores it.
 *
 * Using the token itself as the id makes re-registration idempotent — the same
 * device overwrites its own row instead of accumulating one per launch — but
 * only while the token is a legal id. FCM tokens are base64url with a `:`
 * separator, so they always are; this guards against a malformed value from a
 * failed exchange reaching Firestore, where a `/` would silently create a
 * nested path and `.` or `..` would be rejected outright.
 */
export function isStorablePushToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  if (token.length === 0 || token.length > 1500) return false;
  if (token === '.' || token === '..') return false;
  if (/^__.*__$/.test(token)) return false;
  return /^[A-Za-z0-9_:.~%+-]+$/.test(token);
}
