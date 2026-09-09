/**
 * The welcome email, sent once per account.
 *
 * Two sign-up paths converge here. A password account is welcomed by
 * `/api/auth/verify-otp` the moment its code is accepted — so a welcome only
 * ever goes to an address that proved it can receive mail, and never to a
 * throwaway inbox that scripted past the form. A Google account is welcomed
 * through `/api/auth/welcome`, called by the first-login bootstrap in
 * `src/firebase/provider.tsx`, because the provider already vouched for the
 * address and no code is ever sent.
 *
 * Once, not once per path: `users/{uid}.welcomeMailedAt` is the ledger. It is
 * checked before sending and stamped after a successful send, with the
 * caller's own token, so a retry, a double-submitted form or both paths
 * firing for the same account mail nobody twice. The owner can write the
 * field (the owner update rule allows everything but `role` and `status`),
 * which buys them nothing except suppressing their own welcome.
 *
 * Fire-and-forget by contract: resolves with a result, never throws, and no
 * caller may let it decide the response — losing a welcome is not losing an
 * activation.
 */
import { firestoreGet, firestoreUpdate } from '@/lib/firebase-admin';
import { sendWelcomeEmail } from '@/lib/email';

export type WelcomeOutcome =
  | { sent: true }
  | { sent: false; reason: 'already_welcomed' | 'no_email' | 'skipped' | 'failed' };

/** Display name to greet with: the profile's, else the token's, else none. */
export function welcomeName(
  user: Record<string, unknown> | null | undefined,
  tokenName?: string,
): string | undefined {
  const fromDoc = (user?.displayName as string) || (user?.name as string);
  return fromDoc || tokenName || undefined;
}

export async function sendWelcomeOnce(args: {
  uid: string;
  email: string;
  idToken: string;
  tokenName?: string;
  /** The document if the caller already has it; fetched when omitted. */
  user?: Record<string, unknown> | null;
}): Promise<WelcomeOutcome> {
  const { uid, email, idToken, tokenName } = args;
  if (!email) return { sent: false, reason: 'no_email' };

  try {
    const user =
      args.user === undefined ? await firestoreGet('users', uid, idToken).catch(() => null) : args.user;

    if (user?.welcomeMailedAt) return { sent: false, reason: 'already_welcomed' };

    const result = await sendWelcomeEmail(email, { name: welcomeName(user, tokenName) });
    if (result.skipped) return { sent: false, reason: 'skipped' };
    if (!result.ok) {
      console.error('[welcome] send failed:', result.error ?? result.status);
      return { sent: false, reason: 'failed' };
    }

    // Stamped after the send, not before: a stamp with no mail behind it
    // would silence the welcome for good, while the other order risks at
    // worst a duplicate on a dropped connection.
    await firestoreUpdate('users', uid, { welcomeMailedAt: new Date() }, idToken).catch((err) =>
      console.error('[welcome] stamp failed:', err?.message ?? err),
    );
    return { sent: true };
  } catch (err: any) {
    console.error('[welcome] error:', err?.message ?? err);
    return { sent: false, reason: 'failed' };
  }
}
