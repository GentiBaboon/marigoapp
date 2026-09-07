'use client';

import { useEffect, useRef } from 'react';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { isEmailVerifiedClient } from '@/lib/account-verification';

export type EmailVerificationStatus = 'loading' | 'signed_out' | 'verified' | 'unverified';

/**
 * Is the signed-in member's address confirmed, as far as the browser can tell?
 *
 * Answers from Firebase Auth first (Google and Apple accounts are verified by
 * their provider, no read needed) and only opens the `users/{uid}` listener
 * for a password account. `loading` covers both the auth handshake and that
 * read, so a caller never redirects on a document that has not arrived.
 *
 * `useDoc` starts with `isLoading: false` and only flips it on in its effect,
 * so on the first render with a reference it looks *finished* with no data.
 * Redirecting on that frame would bounce every verified password account
 * once per page. `seenLoading` remembers that the read actually started, and
 * the answer is withheld until it has both started and stopped.
 */
export function useEmailVerification(): { status: EmailVerificationStatus; email: string | null } {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const needsDoc = !!user && user.emailVerified !== true;
  const uid = user?.uid;
  const ref = useMemoFirebase(
    () => (needsDoc && firestore && uid ? doc(firestore, 'users', uid) : null),
    [needsDoc, firestore, uid],
  );
  const { data, isLoading } = useDoc<{ emailVerified?: boolean }>(ref);

  const seenLoading = useRef(false);
  useEffect(() => {
    seenLoading.current = false;
  }, [ref]);
  useEffect(() => {
    if (isLoading) seenLoading.current = true;
  }, [isLoading]);

  if (isUserLoading) return { status: 'loading', email: null };
  if (!user) return { status: 'signed_out', email: null };
  if (user.emailVerified === true) return { status: 'verified', email: user.email };
  if (isLoading || !seenLoading.current) return { status: 'loading', email: user.email };

  return {
    status: isEmailVerifiedClient(user.emailVerified, data) ? 'verified' : 'unverified',
    email: user.email,
  };
}
