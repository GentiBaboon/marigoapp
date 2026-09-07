'use client';

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { signOut, type Auth, type User } from 'firebase/auth';
import { isBannedDoc, isEmailVerifiedClient, verifyEmailHref } from '@/lib/account-verification';

/**
 * Where a just-signed-in member goes: their destination, or the code screen.
 *
 * Sign-up already waits for the code, but the person who closed the tab at
 * that screen and signed in again the next day was let straight through —
 * the sign-in form pushed to `next` and nothing else ever asked. This is the
 * one place every successful sign-in (password, Google, Apple, a returning
 * redirect) decides that.
 *
 * Google and Apple accounts answer from the Auth user alone; a password
 * account costs one document read. A read that *fails* (offline, rules) lets
 * the member through rather than trapping them on a code screen the same
 * outage would break — the API routes still refuse anything that matters.
 */
export type PostLoginResult = { kind: 'go'; to: string } | { kind: 'suspended' };

export async function postLoginDestination(
  firestore: Firestore | null | undefined,
  auth: Auth,
  user: User,
  nextPath: string,
): Promise<PostLoginResult> {
  if (!firestore) return { kind: 'go', to: nextPath };
  let data: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    data = snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('[auth] could not read account state, letting sign-in through:', err);
    return { kind: 'go', to: nextPath };
  }
  // The document is read for every sign-in, provider accounts included,
  // because a ban lives on it. `syncBanToAuth` also disables the Auth user,
  // but that is a deployed function acting after the fact; this answers
  // from the record the admin actually wrote. The session is ended here so
  // the caller has nothing to route.
  if (isBannedDoc(data)) {
    await signOut(auth).catch(() => undefined);
    return { kind: 'suspended' };
  }
  const verified = user.emailVerified || isEmailVerifiedClient(user.emailVerified, data);
  return { kind: 'go', to: verified ? nextPath : verifyEmailHref(nextPath) };
}
