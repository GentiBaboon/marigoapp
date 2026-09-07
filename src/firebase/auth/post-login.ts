'use client';

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { isEmailVerifiedClient, verifyEmailHref } from '@/lib/account-verification';

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
export async function postLoginDestination(
  firestore: Firestore | null | undefined,
  user: User,
  nextPath: string,
): Promise<string> {
  if (user.emailVerified) return nextPath;
  if (!firestore) return nextPath;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    const verified = isEmailVerifiedClient(user.emailVerified, snap.exists() ? snap.data() : null);
    return verified ? nextPath : verifyEmailHref(nextPath);
  } catch (err) {
    console.error('[auth] could not read verification state, letting sign-in through:', err);
    return nextPath;
  }
}
